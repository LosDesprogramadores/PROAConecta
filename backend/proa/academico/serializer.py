from rest_framework import serializers
from usuario.models import Persona
from .models import Materia


class DocenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Persona
        fields = ['id', 'dni', 'nombre', 'apellido', 'email']


class MateriaSerializer(serializers.ModelSerializer):

    docente = DocenteSerializer(source='docente', read_only=True)

    docente = serializers.PrimaryKeyRelatedField(
        queryset=Persona.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Materia
        fields = ['id', 'titulo', 'descripcion', 
                  'criterios_evaluacion', 'anio', 
                  'curso', 'docente']