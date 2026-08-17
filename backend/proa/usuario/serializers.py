from rest_framework import serializers
from .models import Rol, Persona, Administrador, Usuario, UsuarioRol, Docente, Estudiante


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

class UsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Usuario
        fields = [
            'id', 'password', 'persona', 'nombre_usuario', 'email', 'oauth_provider', 'oauth_id', 'activo',
            'fecha_creacion', 'ultimo_acceso'
        ]

