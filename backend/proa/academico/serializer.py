from rest_framework import serializers
from usuario.models import Persona
from .models import Materia, Inscripcion

# Información básica de la persona para mostrar en la lista sea Docente o Estudiante
class PersonaResumenSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.SerializerMethodField()
    rol_nombre = serializers.CharField(source='rol.nombre', read_only=True)

    class Meta:
        model = Persona
        fields = ['id', 'dni', 'nombre', 'apellido', 'nombre_completo', 'email', 'rol_nombre']

    def get_nombre_completo(self, obj):
        return f"{obj.apellido}, {obj.nombre}"


# CRUD de Materia
class MateriaSerializer(serializers.ModelSerializer):
    docente_detalle = PersonaResumenSerializer(source='docente', read_only=True)
    docente = serializers.PrimaryKeyRelatedField(
        queryset=Persona.objects.all(),
        required=False,
        allow_null=True
    )
    total_estudiantes = serializers.IntegerField(source='inscripciones.count', read_only=True)

    class Meta:
        model = Materia
        fields = [
            'id', 'titulo', 'descripcion', 'criterios_evaluacion',
            'anio', 'curso', 'docente', 'docente_detalle',
            'total_estudiantes', 'activo', 'fecha_creacion', 'fecha_actualizacion'
        ]

    def validate_docente(self, value):
        if value:
            rol = getattr(value.rol, 'nombre', '').strip().lower()
            if rol != 'docente':
                raise serializers.ValidationError("La persona seleccionada debe tener rol de 'Docente'.")
            if value.fecha_baja is not None:
                raise serializers.ValidationError("El docente seleccionado está dado de baja.")
        return value

# CRUD de Inscripción uno en uno, Cambio de estado y Baja)
class InscripcionSerializer(serializers.ModelSerializer):
    estudiante_detalle = PersonaResumenSerializer(source='estudiante', read_only=True)
    materia_titulo = serializers.CharField(source='materia.titulo', read_only=True)

    class Meta:
        model = Inscripcion
        fields = [
            'id',
            'materia',
            'materia_titulo',
            'estudiante',
            'estudiante_detalle',
            'estado',
            'fecha_inscripcion'
        ]

    def validate_estudiante(self, value):
        rol = getattr(value.rol, 'nombre', '').strip().lower()
        if rol != 'estudiante':
            raise serializers.ValidationError(f"{value} no posee el rol de 'Estudiante'.")
        if value.fecha_baja is not None:
            raise serializers.ValidationError(f"El estudiante {value} está dado de baja.")
        return value

    def validate(self, attrs):
        materia = attrs.get('materia')
        estudiante = attrs.get('estudiante')

        if self.instance is None and Inscripcion.objects.filter(materia=materia, estudiante=estudiante).exists():
            raise serializers.ValidationError("El estudiante ya se encuentra inscripto en esta materia.")
        return attrs