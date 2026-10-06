from django.contrib.auth import authenticate, login
from rest_framework import viewsets, status, generics, permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Rol, Persona
from .serializers import RolSerializer, PersonaSerializer, DNITokenObtainPairSerializer, UsuarioSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from academico.models import Materia, Inscripcion
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.conf import settings
from core.exceptions import ErrorSerializer
from core.permissions import EsAdministrador
from core.throttling import LimiteDeIntentosMixin
from .correos import enviar_recuperacion
from core.roles import ROL_ADMINISTRADOR, ROL_ESTUDIANTE, ROL_PROFESOR, obtener_persona_y_rol





def _solicitud_invalida(detalle):
    # `error` es un alias temporal de `detail`: login.ts, restablecer-password.ts y cambiar-password.ts
    # del frontend todavía leen `error`. Se quita cuando esas tres pantallas lean `detail`
    return Response({'detail': detalle, 'error': detalle}, status=status.HTTP_400_BAD_REQUEST)


class UsuarioCreateView(generics.CreateAPIView):
    permission_classes = [EsAdministrador]
    serializer_class = UsuarioSerializer

class DNITokenObtainPairView(LimiteDeIntentosMixin, TokenObtainPairView):
    throttle_scope = 'login'
    throttle_identificador = ('dni', 'login_dni')
    serializer_class = DNITokenObtainPairSerializer

class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all()
    serializer_class = RolSerializer

    def get_permissions(self):
        # Lectura para cualquier autenticado; altas, cambios y bajas solo administrador
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [EsAdministrador()]

class PersonaViewSet(viewsets.ModelViewSet):
    queryset = Persona.objects.filter(fecha_baja__isnull=True)
    serializer_class = PersonaSerializer

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

        if rol_nombre == ROL_PROFESOR:
            return Response({'detail': f'Profesor {persona.apellido}, {persona.nombre} se ha eliminado correctamente.'}, status=status.HTTP_200_OK)
        if rol_nombre == ROL_ESTUDIANTE:
            return Response({'detail': f'Estudiante {persona.apellido}, {persona.nombre} se ha eliminado correctamente.'}, status=status.HTTP_200_OK)

        return Response({'detail': 'Registro eliminado correctamente.'}, status=status.HTTP_200_OK)

    @staticmethod
    def _quedan_administradores_activos(excluyendo):
        # Activo: persona sin baja y con cuenta de usuario habilitada
        restantes = Persona.objects.select_for_update(of=('self',)).filter(
            rol__nombre__iexact=ROL_ADMINISTRADOR,
            fecha_baja__isnull=True,
            usuario__activo=True,
        ).exclude(pk=excluyendo.pk)
        return len(restantes) > 0

    @action(detail=True, methods=['post'])
    def restaurar(self, request, pk=None):
    
        persona = Persona.objects.filter(pk=pk).first()
        if not persona:
            return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        
        persona.restore()
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

        usuario.set_password(password_nuevo)
        usuario.debe_cambiar_password = False
        usuario.save()

        return Response({'mensaje': 'Contraseña actualizada con éxito.'},status=status.HTTP_200_OK)


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

        usuario.set_password(password_nuevo)
        usuario.debe_cambiar_password = False
        usuario.save()

        return Response(
            {'mensaje': 'Contraseña restablecida exitosamente. Ya podés iniciar sesión.'},
            status=status.HTTP_200_OK
        )