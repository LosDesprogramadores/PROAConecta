from django.db import transaction
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import Rol, Persona, Usuario
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
import secrets
from django.core.mail import send_mail
from django.conf import settings
from core.roles import es_admin


class SoloLecturaParaNoAdminMixin:
    # Los campos de privilegio solo los escribe un administrador. Sin request en el contexto
    # se asume que no lo es (denegar por defecto)
    campos_de_privilegio = ()

    def get_fields(self):
        campos = super().get_fields()
        request = self.context.get('request')
        if not (request and es_admin(request.user)):
            for nombre in self.campos_de_privilegio:
                campos[nombre].read_only = True
        return campos


class UsuarioSerializer(SoloLecturaParaNoAdminMixin, serializers.ModelSerializer):
    campos_de_privilegio = ('activo',)
    persona_id = serializers.PrimaryKeyRelatedField(
        queryset=Persona.objects.all(),
        source='persona',
        write_only=True,
    )

    class Meta:
        model = Usuario
        fields = ['id', 'persona_id', 'password', 'activo']
        extra_kwargs = {
            'password': {'write_only': True, 'min_length': 8},
        }

    def validate_persona_id(self, persona):
        if hasattr(persona, 'usuario') and persona.usuario is not None:
            raise serializers.ValidationError('Esta persona ya tiene un usuario asociado.')
        return persona

    def create(self, validated_data):
        persona = validated_data.pop('persona')
        password = validated_data.pop('password')

        usuario = Usuario.objects.create_user(
            username=persona.dni,
            password=password,
            persona=persona,
            **validated_data,
        )
        return usuario


class DNITokenObtainPairSerializer(TokenObtainPairSerializer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop('username', None)
        self.fields['dni'] = serializers.CharField()

    def validate(self, attrs):
        dni = attrs.get('dni')
        password = attrs.get('password')

        usuario = authenticate(
            request=self.context.get('request'),
            dni=dni,
            password=password,
        )

        if usuario is None:
            raise serializers.ValidationError(
                'DNI o contraseña incorrectos.',
                code='authorization',
            )

        if not usuario.activo:
            raise serializers.ValidationError(
                'El usuario está inactivo.',
                code='authorization',
            )

        refresh = self.get_token(usuario)

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'debe_cambiar_password': usuario.debe_cambiar_password
        }

class RolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = ['id', 'nombre', 'descripcion']


class PersonaSerializer(SoloLecturaParaNoAdminMixin, serializers.ModelSerializer):
    campos_de_privilegio = ('rol', 'dni', 'email', 'fecha_baja')

    class Meta:
        model = Persona
        fields = [
            'id', 'rol', 'nombre', 'apellido', 'dni', 'fecha_nacimiento',
            'tel_contacto', 'email', 'fecha_ingreso', 'fecha_baja',
        ]
        read_only_fields = ['id', 'fecha_ingreso']

    def create(self, validated_data):
        email = validated_data.get('email')
        dni = validated_data.get('dni')
        nombre = validated_data.get('nombre')
        clave_temporal = secrets.token_urlsafe(8)
        
        with transaction.atomic():
            persona = Persona.objects.create(**validated_data)

            Usuario.objects.create_user(
                username=dni,
                password=clave_temporal,
                persona=persona,
                debe_cambiar_password=True
            )

        asunto = "Bienvenido a PROA Conecta - Credenciales de acceso"
        cuerpo = f"""Hola {nombre},

            Has sido registrado en la plataforma educativa PROA Conecta.

            Tus datos de acceso para iniciar sesión son:
            - DNI (Usuario): {dni}
            - Contraseña provisoria: {clave_temporal}

            Por cuestiones de seguridad, en tu primer ingreso deberás cambiar obligatoriamente esta clave provisoria:
            {getattr(settings, 'FRONTEND_URL', 'http://localhost:4200')}/login

            Saludos cordiales,
            Equipo Directivo PROA Conecta.
            """
        send_mail(
            subject=asunto,
            message=cuerpo,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False
        )

        return persona

    
