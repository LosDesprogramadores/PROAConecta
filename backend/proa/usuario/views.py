from django.contrib.auth import authenticate, login
from rest_framework import viewsets, status, generics, permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Rol, Persona
from .serializers import RolSerializer, PersonaSerializer, DNITokenObtainPairSerializer, UsuarioSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from academico.models import Materia, Inscripcion
from auditoria.bitacora import registrar_evento
from django.db import transaction
from django.db.models import Q
from django.utils.text import slugify
from drf_spectacular.types import OpenApiTypes
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.conf import settings
from core.exceptions import ErrorSerializer
from core.pagination import PaginacionOpcional
from core.exportaciones import exportar_tabla, formato_solicitado
from core.permissions import EsAdministrador
from core.throttling import LimiteDeIntentosMixin, LimitePorIdentificadorThrottle
from .correos import enviar_recuperacion
from .validators import error_de_clave_nueva
from .services import revocar_sesiones
from rest_framework_simplejwt.exceptions import TokenBackendError, TokenError
from rest_framework_simplejwt.state import token_backend
from rest_framework_simplejwt.tokens import RefreshToken
from core.roles import ROL_ADMINISTRADOR, ROL_ESTUDIANTE, ROL_PROFESOR, obtener_persona_y_rol





def _solicitud_invalida(detalle):
    return Response({'detail': detalle}, status=status.HTTP_400_BAD_REQUEST)


class UsuarioCreateView(generics.CreateAPIView):
    permission_classes = [EsAdministrador]
    serializer_class = UsuarioSerializer

class DNITokenObtainPairView(LimiteDeIntentosMixin, TokenObtainPairView):
    throttle_scope = 'login'
    throttle_identificador = ('dni', 'login_dni')
    serializer_class = DNITokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        limite = LimitePorIdentificadorThrottle()
        # El cupo ya se reservó en allow_request: un fallo lo deja consumido, un éxito reinicia la cuenta
        respuesta = super().post(request, *args, **kwargs)
        limite.limpiar(request, self)
        return respuesta

class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all()
    serializer_class = RolSerializer

    def get_permissions(self):
        # Lectura para cualquier autenticado; altas, cambios y bajas solo administrador
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [EsAdministrador()]

RECURSO_POR_ROL = {ROL_ESTUDIANTE: 'estudiantes', ROL_PROFESOR: 'profesores'}


def _activo(persona):
    usuario = getattr(persona, 'usuario', None)
    return 'Sí' if usuario is None or usuario.activo else 'No'


class PersonaViewSet(viewsets.ModelViewSet):
    queryset = Persona.objects.filter(fecha_baja__isnull=True)
    serializer_class = PersonaSerializer
    pagination_class = PaginacionOpcional

    def get_permissions(self):
        # Lectura para cualquier autenticado; altas, cambios, bajas y restauración solo administrador
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [EsAdministrador()]

    def destroy(self, request, *args, **kwargs):
        persona = self.get_object()
        rol_nombre = persona.rol.nombre.strip().lower() if persona.rol else None
        mi_persona, _ = obtener_persona_y_rol(request.user)

        if mi_persona is not None and persona.pk == mi_persona.pk:
            return Response(
                {'detail': 'No se puede eliminar tu propia cuenta.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Materia.objects solo ve materias activas: una dada de baja no impide dar de baja al profesor
        if rol_nombre == ROL_PROFESOR and Materia.objects.filter(profesor=persona).exists():
            return Response(
                {'detail': 'No se puede eliminar un profesor con materias asignadas.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if rol_nombre == ROL_ESTUDIANTE and Inscripcion.objects.filter(
            estudiante=persona
        ).exclude(estado=Inscripcion.EstadoInscripcion.BAJA).exists():
            return Response(
                {'detail': 'No se puede eliminar un estudiante que tiene materias o inscripciones activas.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Dos bajas simultáneas de los dos últimos administradores: se bloquean los
            # administradores activos restantes para que la verificación y la baja sean atómicas
            if rol_nombre == ROL_ADMINISTRADOR and not self._quedan_administradores_activos(excluyendo=persona):
                return Response(
                    {'detail': 'No se puede eliminar al último administrador activo.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            persona.soft_delete()
            registrar_evento(
                'PERSONA_BAJA', request.user, 'persona',
                {'antes': {'activo': True}, 'despues': {'activo': False}}, entidad_id=persona.pk,
            )

        if rol_nombre == ROL_PROFESOR:
            return Response({'detail': f'Profesor {persona.apellido}, {persona.nombre} se ha eliminado correctamente.'}, status=status.HTTP_200_OK)
        if rol_nombre == ROL_ESTUDIANTE:
            return Response({'detail': f'Estudiante {persona.apellido}, {persona.nombre} se ha eliminado correctamente.'}, status=status.HTTP_200_OK)

        return Response({'detail': 'Registro eliminado correctamente.'}, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        rol_previo = serializer.instance.rol_id
        with transaction.atomic():
            persona = serializer.save()
            if persona.rol_id != rol_previo:
                registrar_evento(
                    'ROL_CAMBIADO', self.request.user, 'persona',
                    {'antes': {'rol_id': rol_previo}, 'despues': {'rol_id': persona.rol_id}}, entidad_id=persona.pk,
                )

    @staticmethod
    def _quedan_administradores_activos(excluyendo):
        # Activo: persona sin baja y con cuenta de usuario habilitada
        restantes = Persona.objects.select_for_update(of=('self',)).filter(
            rol__nombre__iexact=ROL_ADMINISTRADOR,
            fecha_baja__isnull=True,
            usuario__activo=True,
        ).exclude(pk=excluyendo.pk)
        return len(restantes) > 0

    @extend_schema(
        parameters=[
            OpenApiParameter('rol', str, description='Id o nombre del rol (opcional)'),
            OpenApiParameter('formato', str, enum=['csv', 'pdf'], description='csv (defecto) o pdf'),
            OpenApiParameter('search', str, description='Nombre, apellido, DNI o correo'),
        ],
        responses={200: OpenApiTypes.BINARY, 400: ErrorSerializer},
    )
    @action(detail=False, methods=['get'], url_path='exportar')
    def exportar(self, request):
        formato = formato_solicitado(request)
        personas = self.get_queryset().select_related('rol', 'usuario').order_by('apellido', 'nombre', 'id')

        rol = request.query_params.get('rol')
        recurso = 'personas'
        if rol:
            rol_obj = (Rol.objects.filter(pk=rol) if rol.isdigit() else Rol.objects.filter(nombre__iexact=rol)).first()
            if rol_obj is None:
                raise ValidationError({'detail': 'El rol indicado no existe.'})
            personas = personas.filter(rol=rol_obj)
            recurso = RECURSO_POR_ROL.get(rol_obj.nombre.strip().lower(), slugify(rol_obj.nombre))

        busqueda = request.query_params.get('search')
        if busqueda:
            personas = personas.filter(
                Q(nombre__icontains=busqueda) | Q(apellido__icontains=busqueda)
                | Q(dni__icontains=busqueda) | Q(email__icontains=busqueda)
            )

        con_materias = recurso == 'profesores'
        if con_materias:
            personas = personas.prefetch_related('materias_a_cargo')

        # El PDF no lleva DNI ni teléfono (contrato de exportaciones)
        if formato == 'pdf':
            columnas = ['apellido', 'nombre', 'email', 'activo']
            filas = ([p.apellido, p.nombre, p.email, _activo(p)] for p in personas.iterator())
        else:
            columnas = ['dni', 'apellido', 'nombre', 'email', 'tel_contacto', 'activo', 'fecha_alta']
            if con_materias:
                columnas.append('materias_asignadas')
            filas = (
                [p.dni, p.apellido, p.nombre, p.email, p.tel_contacto, _activo(p), p.fecha_ingreso.isoformat()]
                + (['; '.join(m.titulo for m in p.materias_a_cargo.all())] if con_materias else [])
                for p in personas
            )
        return exportar_tabla(formato, recurso, recurso.capitalize(), columnas, filas)

    @action(detail=True, methods=['post'])
    def restaurar(self, request, pk=None):
    
        persona = Persona.objects.filter(pk=pk).first()
        if not persona:
            return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        
        estaba_de_baja = persona.fecha_baja is not None
        with transaction.atomic():
            persona.restore()
            if estaba_de_baja:
                registrar_evento(
                    'PERSONA_RESTAURADA', request.user, 'persona',
                    {'antes': {'activo': False}, 'despues': {'activo': True}}, entidad_id=persona.pk,
                )
        return Response({'detail': 'Persona restaurada correctamente.'}, status=status.HTTP_200_OK)

MENSAJE_OK = inline_serializer('MensajeExito', {'mensaje': serializers.CharField()})


class PersonaRolView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[OpenApiParameter('rol', int, description='Id del rol (obligatorio)')],
        responses={200: PersonaSerializer(many=True), 400: ErrorSerializer},
    )
    def get(self, request):
        rol_id = request.query_params.get('rol')
        
        if not rol_id:
            return Response({'detail': 'Debe especificar el rol.'}, status=status.HTTP_400_BAD_REQUEST)

        personas = (
            Persona.objects
            .filter(rol_id=rol_id, fecha_baja__isnull=True)
            .select_related('rol')
            .order_by('apellido', 'nombre')
        )
        # Con ?page responde el sobre paginado; sin él, el arreglo de siempre
        paginador = PaginacionOpcional()
        pagina = paginador.paginate_queryset(personas, request, view=self)
        if pagina is not None:
            serializer = PersonaSerializer(pagina, many=True, context={'request': request})
            return paginador.get_paginated_response(serializer.data)

        serializer = PersonaSerializer(personas, many=True, context={'request': request})

        return Response(serializer.data, status=status.HTTP_200_OK)



class PerfilUsuarioView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        usuario = request.user
        persona = getattr(usuario, 'persona', None)

        rol_id = None
        rol_nombre = None
        if persona and persona.rol:
            rol_id = persona.rol.id
            rol_nombre = persona.rol.nombre

        data = {
            "id": usuario.id,
            "userName": usuario.username,
            "rolId": rol_id,
            "rolNombre": rol_nombre,
            "persona": {
                "id": persona.id if persona else None,
                "nombre": persona.nombre if persona else "",
                "apellido": persona.apellido if persona else "",
                "dni": persona.dni if persona else "",
                "email": persona.email if persona else "",
                "tel_contacto": persona.tel_contacto if persona else ""
            } if persona else None
        }
        return Response(data, status=status.HTTP_200_OK)


User = get_user_model()



class CambiarPasswordPrimerIngresoView(APIView):
    """
    Para cambiar clave provisoria
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=inline_serializer('CambiarPasswordPrimerIngreso', {
            'password_actual': serializers.CharField(), 'password_nuevo': serializers.CharField(min_length=8),
        }),
        responses={200: MENSAJE_OK, 400: ErrorSerializer},
    )
    def post(self, request):
        usuario = request.user
        password_actual = request.data.get('password_actual')
        password_nuevo = request.data.get('password_nuevo')

        if not password_actual or not password_nuevo:
            return _solicitud_invalida('Debe ingresar la contraseña actual y la nueva contraseña.')

        if not usuario.check_password(password_actual):
            return _solicitud_invalida('La contraseña actual no es correcta.')

        if len(password_nuevo) < 8:
            return _solicitud_invalida('La nueva contraseña debe contener al menos 8 caracteres.')

        if password_actual == password_nuevo:
            return _solicitud_invalida('La nueva contraseña no debe ser igual a la provisoria.')

        error = error_de_clave_nueva(password_nuevo, usuario)
        if error:
            return _solicitud_invalida(error)

        usuario.set_password(password_nuevo)
        usuario.debe_cambiar_password = False
        with transaction.atomic():
            usuario.save()
            # Las sesiones abiertas con la clave anterior dejan de poder renovarse
            revocar_sesiones(usuario)

        # El refresh del propio usuario también quedó revocado: se le entrega un par nuevo, con la forma del login
        refresh = RefreshToken.for_user(usuario)
        return Response({
            'mensaje': 'Contraseña actualizada con éxito.',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'debe_cambiar_password': False,
        }, status=status.HTTP_200_OK)


class CerrarSesionView(APIView):
    """Revoca el refresh recibido. Idempotente: repetir el cierre con el mismo token también responde 204.

    No exige un access vigente (mismo modelo que TokenBlacklistView de simplejwt): quien tiene el
    refresh válido prueba que la sesión es suya, y con el access vencido el cierre no puede fallar.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=inline_serializer('CerrarSesion', {'refresh': serializers.CharField()}),
        responses={204: None, 400: ErrorSerializer},
    )
    def post(self, request):
        refresh = request.data.get('refresh')
        if not refresh or not isinstance(refresh, str):
            return _solicitud_invalida('Debe enviar el token de renovación.')

        # La firma y el vencimiento se validan sin mirar la blacklist, para que repetir el cierre sea idempotente
        try:
            payload = token_backend.decode(refresh)
        except TokenBackendError:
            return _solicitud_invalida('El token de renovación es inválido.')

        if payload.get('token_type') != 'refresh':
            return _solicitud_invalida('El token de renovación es inválido.')

        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            pass  # ya estaba en la blacklist
        return Response(status=status.HTTP_204_NO_CONTENT)


class SolicitarRecuperacionPasswordView(LimiteDeIntentosMixin, APIView):
    """
    Recibe el email registrado al crear la persona y envia token seguro
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'recuperacion'
    throttle_identificador = ('email', 'recuperacion_email')

    @extend_schema(
        request=inline_serializer('SolicitarRecuperacion', {'email': serializers.EmailField()}),
        responses={200: MENSAJE_OK, 400: ErrorSerializer, 429: ErrorSerializer},
    )
    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return _solicitud_invalida('Debe ingresar un correo electrónico.')

        usuario = User.objects.filter(persona__email__iexact=email,activo=True,persona__fecha_baja__isnull=True).select_related('persona').first()
        if usuario:
            uid = urlsafe_base64_encode(force_bytes(usuario.pk))
            token = default_token_generator.make_token(usuario)
            frontend_url = getattr(settings, 'FRONTEND_URL','http://localhost:4200')
            enlace = f"{frontend_url}/restablecer-password?uid={uid}&token={token}"

            # Se envía en segundo plano: la respuesta no espera al SMTP ni delata por la demora si el correo existe
            enviar_recuperacion(usuario, enlace)

        return Response(
            {'mensaje': 'Si el correo ingresado se encuentra registrado, recibirás un enlace de restablecimiento a la brevedad.'},
            status=status.HTTP_200_OK
        )

class ConfirmarRecuperacionPasswordView(LimiteDeIntentosMixin, APIView):
    """Valida el token de un solo uso recibido por email y actualiza la contraseña."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'recuperacion_confirmar'

    @extend_schema(
        request=inline_serializer('ConfirmarRecuperacion', {
            'uid': serializers.CharField(), 'token': serializers.CharField(),
            'password_nuevo': serializers.CharField(min_length=8),
        }),
        responses={200: MENSAJE_OK, 400: ErrorSerializer, 429: ErrorSerializer},
    )
    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        password_nuevo = request.data.get('password_nuevo')

        if not all([uidb64, token, password_nuevo]):
            return _solicitud_invalida('Faltan parámetros requeridos (uid, token o nueva contraseña).')

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            usuario = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return _solicitud_invalida('El enlace de recuperación es inválido o ha expirado.')

        if not default_token_generator.check_token(usuario, token):
            return _solicitud_invalida('El enlace ha expirado o ya fue utilizado.')

        if len(password_nuevo) < 8:
            return _solicitud_invalida('La contraseña debe contener al menos 8 caracteres.')

        error = error_de_clave_nueva(password_nuevo, usuario)
        if error:
            return _solicitud_invalida(error)

        usuario.set_password(password_nuevo)
        usuario.debe_cambiar_password = False
        with transaction.atomic():
            usuario.save()
            # Las sesiones abiertas con la clave anterior dejan de poder renovarse
            revocar_sesiones(usuario)

        return Response(
            {'mensaje': 'Contraseña restablecida exitosamente. Ya podés iniciar sesión.'},
            status=status.HTTP_200_OK
        )