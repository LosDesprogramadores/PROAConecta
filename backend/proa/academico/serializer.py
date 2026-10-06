from rest_framework import serializers
from usuario.models import Persona
from core.privacidad import PrivacidadPersonaMixin
from core.roles import ROL_ESTUDIANTE, ROL_PROFESOR, es_admin
from .models import Materia, Inscripcion

# Información básica de la persona para mostrar en la lista sea profesor o Estudiante
class PersonaResumenSerializer(PrivacidadPersonaMixin, serializers.ModelSerializer):
    # Un no administrador solo ve nombre y rol de otra persona (sin DNI ni email)
    campos_publicos = ('id', 'nombre', 'apellido', 'nombre_completo', 'rol_nombre')
    nombre_completo = serializers.SerializerMethodField()
    rol_nombre = serializers.CharField(source='rol.nombre', read_only=True)

    class Meta:
        model = Persona
        fields = ['id', 'dni', 'nombre', 'apellido', 'nombre_completo', 'email', 'rol_nombre']

    def get_nombre_completo(self, obj):
        return f"{obj.apellido}, {obj.nombre}"


# Alumno de una materia para el profesor: sin dni, teléfono, fecha de nacimiento ni domicilio
class AlumnoMateriaSerializer(serializers.ModelSerializer):
    inscripcion_id = serializers.IntegerField(source='id', read_only=True)
    persona_id = serializers.IntegerField(source='estudiante_id', read_only=True)
    apellido = serializers.CharField(source='estudiante.apellido', read_only=True)
    nombre = serializers.CharField(source='estudiante.nombre', read_only=True)
    email = serializers.EmailField(source='estudiante.email', read_only=True)

    class Meta:
        model = Inscripcion
        fields = ['inscripcion_id', 'persona_id', 'apellido', 'nombre', 'email', 'estado', 'fecha_inscripcion']
        read_only_fields = fields


# CRUD de Materia
class MateriaSerializer(serializers.ModelSerializer):
    profesor_detalle = PersonaResumenSerializer(source='profesor', read_only=True)
    profesor = serializers.PrimaryKeyRelatedField(
        queryset=Persona.objects.all(),
        required=False,
        allow_null=True
    )
    total_estudiantes = serializers.SerializerMethodField()

    class Meta:
        model = Materia
        fields = [
            'id', 'titulo', 'descripcion', 'criterios_evaluacion',
            'anio', 'curso', 'profesor', 'profesor_detalle',
            'total_estudiantes', 'activo', 'fecha_creacion', 'fecha_actualizacion','discord_webhook_url'
        ]

    def to_representation(self, instance):
        datos = super().to_representation(instance)
        # El webhook es un secreto: solo el administrador lo lee (el formulario de edición lo necesita)
        request = self.context.get('request')
        if not (request and es_admin(request.user)):
            datos.pop('discord_webhook_url', None)
        return datos

    def get_total_estudiantes(self, obj):
        # El listado ya trae la cuenta anotada (selectors.materias_con_resumen); las respuestas de
        # alta y edición no pasan por ahí y la calculan acá. Las bajas no cuentan como estudiantes
        if hasattr(obj, 'total_estudiantes'):
            return obj.total_estudiantes
        return obj.inscripciones.exclude(estado=Inscripcion.EstadoInscripcion.BAJA).count()

    def validate_profesor(self, value):
        if value:
            rol = getattr(value.rol, 'nombre', '').strip().lower()
            if rol != 'profesor':
                raise serializers.ValidationError("La persona seleccionada debe tener rol de 'profesor'.")
            if value.fecha_baja is not None:
                raise serializers.ValidationError("El profesor seleccionado está dado de baja.")
        return value

# CRUD de Inscripción uno en uno, Cambio de estado y Baja)
class InscripcionSerializer(serializers.ModelSerializer):
    estudiante_detalle = PersonaResumenSerializer(source='estudiante', read_only=True)
    materia_titulo = serializers.CharField(source='materia.titulo', read_only=True)
    materia_curso = serializers.CharField(source='materia.curso', read_only=True)
    materia_anio = serializers.IntegerField(source='materia.anio', read_only=True)
    profesor_nombre = serializers.SerializerMethodField()
    class Meta:
        model = Inscripcion
        fields = [
          'id',
            'materia',
            'materia_titulo',
            'materia_curso',       
            'materia_anio',       
            'profesor_nombre',
            'estudiante',
            'estudiante_detalle',
            'estado',
            'fecha_inscripcion',
        ]
    
    def get_profesor_nombre(self, obj):
        prof = obj.materia.profesor
        return f"{prof.apellido}, {prof.nombre}" if prof else "Sin asignar"

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

# Entrada de los endpoints en lote: validan existencia, rol y duplicados antes de tocar la base
def _ids_de_materias_validos(valor):
    repetidos = sorted({m for m in valor if valor.count(m) > 1})
    if repetidos:
        raise serializers.ValidationError(
            f'No se pueden repetir materias: {", ".join(map(str, repetidos))}.'
        )
    existentes = set(Materia.objects.filter(id__in=valor).values_list('id', flat=True))
    faltantes = [m for m in valor if m not in existentes]
    if faltantes:
        raise serializers.ValidationError(
            f'No existen materias con id: {", ".join(map(str, faltantes))}.'
        )
    return valor


def _persona_con_rol(valor, rol, etiqueta):
    nombre_rol = valor.rol.nombre.strip().lower() if valor.rol else None
    if nombre_rol != rol:
        raise serializers.ValidationError(f"{valor} no posee el rol de '{etiqueta}'.")
    if valor.fecha_baja is not None:
        raise serializers.ValidationError(f'{valor} está dado de baja.')
    return valor


class _MateriaIdsField(serializers.ListField):
    def __init__(self, **kwargs):
        super().__init__(
            child=serializers.IntegerField(
                min_value=1,
                error_messages={'invalid': 'Cada id de materia debe ser un número entero.'},
            ),
            allow_empty=False,
            error_messages={
                'required': 'Debes enviar un array materia_ids con al menos un ID.',
                'null': 'Debes enviar un array materia_ids con al menos un ID.',
                'not_a_list': 'Debes enviar un array materia_ids con al menos un ID.',
                'empty': 'Debes enviar un array materia_ids con al menos un ID.',
            },
            **kwargs,
        )


def _persona_field(etiqueta):
    return serializers.PrimaryKeyRelatedField(
        queryset=Persona.objects.select_related('rol'),
        error_messages={
            'required': 'Este campo es obligatorio.',
            'does_not_exist': f'No existe {etiqueta} con id {{pk_value}}.',
            'incorrect_type': 'El id debe ser un número entero.',
        },
    )


class AsignarProfesorSerializer(serializers.Serializer):
    profesor_id = _persona_field('un profesor')
    materia_ids = _MateriaIdsField()

    def validate_profesor_id(self, value):
        return _persona_con_rol(value, ROL_PROFESOR, 'Profesor')

    def validate_materia_ids(self, value):
        return _ids_de_materias_validos(value)


class InscribirLoteSerializer(serializers.Serializer):
    estudiante_id = _persona_field('un estudiante')
    materia_ids = _MateriaIdsField()

    def validate_estudiante_id(self, value):
        return _persona_con_rol(value, ROL_ESTUDIANTE, 'Estudiante')

    def validate_materia_ids(self, value):
        return _ids_de_materias_validos(value)


class DesinscribirSerializer(serializers.Serializer):
    estudiante_id = _persona_field('un estudiante')
    materia_id = serializers.PrimaryKeyRelatedField(
        queryset=Materia.objects.all(),
        error_messages={
            'required': 'Este campo es obligatorio.',
            'does_not_exist': 'No existe una materia con id {pk_value}.',
            'incorrect_type': 'El id debe ser un número entero.',
        },
    )
