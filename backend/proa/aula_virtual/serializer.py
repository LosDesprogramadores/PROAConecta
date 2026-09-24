from django.utils import timezone
from rest_framework import serializers
from .models import Unidad, Material, Actividad, Entrega, Nota
from .helpers import es_admin, es_estudiante, es_profesor, obtener_persona_y_rol, verificar_profesor_materia, verificar_estudiante_materia, validar_rango_nota


class UnidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidad
        fields = ['id', 'materia', 'titulo', 'descripcion', 'orden', 'visible', 'fecha_baja']
        read_only_fields = ['id', 'fecha_baja']

    def validate(self, attrs):
        # Validación de permisos usando helpers.py
        request = self.context.get('request')
        if request and 'materia' in attrs:
            verificar_profesor_materia(request.user, attrs['materia'])
        
        return attrs


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = [
            'id', 'materia', 'unidad', 'tipo', 'titulo',
            'descripcion', 'archivo', 'enlace', 'visible',
            'fecha_publicacion', 'fecha_baja'
        ]
        read_only_fields = ['id', 'fecha_publicacion', 'fecha_baja']

    def to_internal_value(self, data):
        if hasattr(data, 'dict'):
            data_dict = {key: data[key] for key in data}
        else:
            data_dict = data.copy()

    # Formateo de la URL del enlace
        enlace = data_dict.get('enlace')
        if enlace and isinstance(enlace, str):
            enlace = enlace.strip()
        if enlace and not enlace.startswith(('http://', 'https://')):
            data_dict['enlace'] = f'https://{enlace}'

        return super().to_internal_value(data_dict)

    def validate(self, attrs):
        materia = attrs.get('materia', getattr(self.instance, 'materia', None))
        unidad = attrs.get('unidad', getattr(self.instance, 'unidad', None))

        # Validación de permisos
        request = self.context.get('request')
        if request and 'materia' in attrs:
            verificar_profesor_materia(request.user, attrs['materia'])

        # Integridad relacional entre material y unidad
        if unidad:
            materia_id = getattr(materia, 'id', materia)
            if unidad.materia_id != materia_id:
                raise serializers.ValidationError({
                    'unidad': 'La unidad seleccionada no pertenece a la materia especificada.'
                })

            if unidad.fecha_baja is not None:
                raise serializers.ValidationError({
                    'unidad': 'No se puede asociar material a una unidad dada de baja.'
                })

        return attrs


class ActividadSerializer(serializers.ModelSerializer):
    materia_titulo = serializers.CharField(source='materia.titulo', read_only=True)
    unidad_titulo = serializers.CharField(source='unidad.titulo', read_only=True, default=None)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    cantidad_entregas = serializers.IntegerField(source='entregas.count', read_only=True)

    class Meta:
        model = Actividad
        fields = [
                    'id', 'materia', 'materia_titulo', 'unidad', 'unidad_titulo',
                    'titulo', 'descripcion', 'enlace', 'archivo_adjunto',
                    'fecha_limite', 'permitir_entrega_tardia', 'estado',
                    'estado_display', 'cantidad_entregas', 'fecha_creacion', 'fecha_baja'
        ]
        read_only_fields = ['id', 'fecha_creacion', 'fecha_baja']

    def validate(self, attrs):
        request = self.context.get('request')
        materia = attrs.get('materia', getattr(self.instance, 'materia', None))
        unidad = attrs.get('unidad', getattr(self.instance, 'unidad', None))

        if request and 'materia' in attrs:
            verificar_profesor_materia(request.user, attrs['materia'])

        # La unidad debe pertenecer a la misma materia
        if unidad:
            materia_id = getattr(materia, 'id', materia)
            if unidad.materia_id != materia_id:
                raise serializers.ValidationError({
                    'unidad': 'La unidad seleccionada no pertenece a la materia especificada.'
                })
            if unidad.fecha_baja is not None:
                raise serializers.ValidationError({
                    'unidad': 'No se puede asociar una actividad a una unidad dada de baja.'
                })

        estado = attrs.get('estado', getattr(self.instance, 'estado', None))
        fecha_limite = attrs.get('fecha_limite', getattr(self.instance, 'fecha_limite', None))

        if estado == Actividad.EstadoActividad.PUBLICADA and fecha_limite is None:
            raise serializers.ValidationError({
                'fecha_limite': 'Una actividad publicada debe tener una fecha límite definida.'
            })
        
        return attrs


class NotaSerializer(serializers.ModelSerializer):
    profesor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Nota
        fields = ['id', 'calificacion', 'descripcion', 'profesor_nombre', 'fecha_publicacion']

    def get_profesor_nombre(self, obj):
        return f"{obj.profesor.nombre} {obj.profesor.apellido}".strip() if obj.profesor else None


class EntregaSerializer(serializers.ModelSerializer):
    nota = NotaSerializer(read_only=True)
    estudiante_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Entrega
        fields = [
            'id', 'actividad', 'estudiante', 'estudiante_nombre',
            'archivo', 'enlace', 'contenido_texto',
            'fuera_de_termino', 'estado', 'fecha_entrega', 'fecha_baja', 'nota'
        ]
        read_only_fields = ['id', 'estudiante', 'fuera_de_termino', 'estado', 'fecha_entrega', 'fecha_baja', 'nota']

    def get_estudiante_nombre(self, obj):
        return f"{obj.estudiante.nombre} {obj.estudiante.apellido}".strip() if obj.estudiante else None

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        actividad = attrs.get('actividad', getattr(self.instance, 'actividad', None))

        if not actividad or actividad.fecha_baja is not None:
            raise serializers.ValidationError({"actividad": "La actividad no existe o fue dada de baja."})

        if actividad.estado != Actividad.EstadoActividad.PUBLICADA and not (user and es_admin(user)):
            raise serializers.ValidationError({"actividad": "No se pueden realizar entregas en actividades en borrador."})

        ahora = timezone.now()
        plazo_vencido = bool(actividad.fecha_limite and ahora > actividad.fecha_limite)

        if self.instance is not None:
            if user and es_estudiante(user):
                if self.instance.estado == Entrega.EstadoEntrega.CORREGIDO:
                    raise serializers.ValidationError("Esta entrega ya ha sido calificada y no se puede modificar.")

                if plazo_vencido and not actividad.permitir_entrega_tardia:
                    raise serializers.ValidationError("El plazo límite de la actividad finalizó. No puedes modificar ni reemplazar los archivos.")

        else:
            if user and not es_admin(user):
                verificar_estudiante_materia(user, actividad.materia)

            if plazo_vencido and not actividad.permitir_entrega_tardia:
                raise serializers.ValidationError("El plazo de entrega ha vencido y no se aceptan entregas fuera de término.")

            if user:
                persona, _ = obtener_persona_y_rol(user)
                if not persona:
                    raise serializers.ValidationError("El usuario autenticado no posee un perfil asociado.")
                if Entrega.objects.filter(actividad=actividad, estudiante=persona, fecha_baja__isnull=True).exists():
                    raise serializers.ValidationError("Ya tienes una entrega activa para esta actividad.")

        archivo = attrs.get('archivo', getattr(self.instance, 'archivo', None))
        enlace = attrs.get('enlace', getattr(self.instance, 'enlace', None))
        contenido_texto = attrs.get('contenido_texto', getattr(self.instance, 'contenido_texto', None))

        if not any([archivo, enlace, contenido_texto]):
            raise serializers.ValidationError("Debes enviar al menos un archivo, enlace o texto.")

        return attrs