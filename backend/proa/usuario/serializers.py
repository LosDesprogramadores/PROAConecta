from rest_framework import serializers
from .models import Rol, Persona, Administrador, Docente, Estudiante


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

##en construccion# no esta terminado ni usuario, ni rol usuario#

##no esta terminado ni usuario, ni rol usuario##

#class UsuarioRol(serializers.ModelSerializer):#

class DocenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Docente
        fields = '__all__'

class EstudianteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Estudiante
        fields = '__all__'