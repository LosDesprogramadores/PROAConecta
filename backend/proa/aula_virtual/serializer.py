from rest_framework import serializers
from .models import Unidad, Material, Actividad
from .helpers import verificar_profesor_materia


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