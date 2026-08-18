from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import Rol, Persona, Administrador, Docente, Estudiante, Usuario, UsuarioRol
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = '__all__'

class UsuarioRolSerializer(serializers.ModelSerializer):
    class Meta:
        model = UsuarioRol
        fields = '__all__'

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
        }

class RolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = '__all__'

class  PersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Persona
        fields = '__all__'

class AdministradorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Administrador
        fields = '__all__'


class DocenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Docente
        fields = '__all__'

class EstudianteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Estudiante
        fields = '__all__'