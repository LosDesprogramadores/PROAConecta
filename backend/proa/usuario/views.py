from django.contrib.auth import authenticate, login
from rest_framework import viewsets, status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Rol, Persona
from .serializers import RolSerializer, PersonaSerializer, DNITokenObtainPairSerializer, UsuarioSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from academico.models import Materia, Inscripcion
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings





class UsuarioCreateView(generics.CreateAPIView):
    serializer_class = UsuarioSerializer

class DNITokenObtainPairView(TokenObtainPairView):
    serializer_class = DNITokenObtainPairSerializer

class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all()
    serializer_class = RolSerializer

class PersonaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Persona.objects.filter(fecha_baja__isnull=True)
    serializer_class = PersonaSerializer

    def destroy(self, request, *args, **kwargs):
        persona = self.get_object()
        rol_nombre = persona.rol.nombre 
                
        if rol_nombre == "Profesor":
            tiene_materias = Materia.objects.filter(profesor=persona).exists()

            if tiene_materias:
                return Response(
                    {'detail': 'No se puede eliminar un profesor con materias asignadas.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        elif rol_nombre == "Estudiante":
          tiene_inscripciones = Inscripcion.objects.filter(
            estudiante=persona
          ).exclude(estado=Inscripcion.EstadoInscripcion.BAJA).exists()

        if tiene_inscripciones:
            return Response(
                {'detail': 'No se puede eliminar un estudiante que tiene materias o inscripciones activas.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        persona.fecha_baja = timezone.now().date()
        persona.save()
        if rol_nombre == 'Profesor':
               return Response({'detail': 'Profesor {persona.apellido}, {persona.nombre} se ha eliminado correctamente.'.format(persona=persona)}, status=status.HTTP_200_OK)
        elif rol_nombre == 'Estudiante':
               return Response({'detail': 'Estudiante {persona.apellido}, {persona.nombre} se ha eliminado correctamente.'.format(persona=persona)}, status=status.HTTP_200_OK)
        
        return Response({'detail': 'Registro eliminado correctamente.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def restaurar(self, request, pk=None):
    
        persona = Persona.objects.filter(pk=pk).first()
        if not persona:
            return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        
        persona.restore()
        return Response({'detail': 'Persona restaurada correctamente.'}, status=status.HTTP_200_OK)

class PersonaRolView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        rol_id = request.query_params.get('rol')
        
        if not rol_id:
            return Response(
                {"error": "Debe especificar el rol."},
                status=status.HTTP_400_BAD_REQUEST
            )

        personas = (
            Persona.objects
            .filter(rol_id=rol_id, fecha_baja__isnull=True)
            .select_related('rol')
            .order_by('apellido', 'nombre')
        )
        serializer = PersonaSerializer(personas, many=True)

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

    def post(self, request):
        usuario = request.user
        password_actual = request.data.get('password_actual')
        password_nuevo = request.data.get('password_nuevo')

        if not password_actual or not password_nuevo:
            return Response({'error': 'Debe ingresar la contraseña actual y la nueva contrtaseña.'}, status=status.HTTP_400_BAD_REQUEST)

        if not usuario.check_password(password_actual):
            return Response({'error': 'La contraseña actual no es correcta.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(password_nuevo) < 8:
            return Response({'error': 'La nueva contraseña debe contener al menos 8 caracteres.'},status=status.HTTP_400_BAD_REQUEST)

        if password_actual == password_nuevo:
            return Response({'error': 'La nueva contraseña no debe ser igual a la provisoria.'}, status=status.HTTP_400_BAD_REQUEST)

        usuario.set_password(password_nuevo)
        usuario.debe_cambiar_password = False
        usuario.save()

        return Response({'mensaje': 'Contraseña actualizada con éxito.'},status=status.HTTP_200_OK)


class SolicitarRecuperacionPasswordView(APIView):
    """
    Recibe el email registrado al crear la persona y envia token seguro
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Debe ingresar un correo electrónico.'}, status=status.HTTP_400_BAD_REQUEST)

        usuario = User.objects.filter(persona__email__iexact=email,activo=True,persona__fecha_baja__isnull=True).select_related('persona').first()
        if usuario:
            uid = urlsafe_base64_encode(force_bytes(usuario.pk))
            token = default_token_generator.make_token(usuario)
            frontend_url = getattr(settings, 'FRONTEND_URL','http://localhost:4200')
            enlace = f"{frontend_url}/restablecer-password?uid={uid}&token={token}"

            asunto = "PROA Conecta - Recuperación de contraseña"
            cuerpo = f"""Hola {usuario.persona.nombre if usuario.persona else 'Usuario'},

            Recibimos una solicitud para restablecer la contraseña de tu cuenta institucional en PROA Conecta.

            Para crear una nueva clave, ingresá al siguiente enlace:
            {enlace}

            Este enlace es de uso único y tiene validez temporal. Si no solicitaste este cambio, podés desestimar este mensaje.

            Atentamente,
            Equipo PROA Conecta.
            """
            send_mail(
                subject=asunto,
                message=cuerpo,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False
            )

        return Response(
            {'mensaje': 'Si el correo ingresado se encuentra registrado, recibirás un enlace de restablecimiento a la brevedad.'},
            status=status.HTTP_200_OK
        )

class ConfirmarRecuperacionPasswordView(APIView):
    """Valida el token de un solo uso recibido por email y actualiza la contraseña."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        password_nuevo = request.data.get('password_nuevo')

        if not all([uidb64, token, password_nuevo]):
            return Response(
                {'error': 'Faltan parámetros requeridos (uid, token o nueva contraseña).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            usuario = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {'error': 'El enlace de recuperación es inválido o ha expirado.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not default_token_generator.check_token(usuario, token):
            return Response(
                {'error': 'El enlace ha expirado o ya fue utilizado.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(password_nuevo) < 8:
            return Response(
                {'error': 'La contraseña debe contener al menos 8 caracteres.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        usuario.set_password(password_nuevo)
        usuario.debe_cambiar_password = False
        usuario.save()

        return Response(
            {'mensaje': 'Contraseña restablecida exitosamente. Ya podés iniciar sesión.'},
            status=status.HTTP_200_OK
        )