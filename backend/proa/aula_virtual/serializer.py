from rest_framework import serializers
from .models import Unidad, Material
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
        try:
            data = data.copy()
        except AttributeError:
            pass

        enlace = data.get('enlace')
        if enlace and isinstance(enlace, str):
            enlace = enlace.strip()
            if enlace and not enlace.startswith(('http://', 'https://')):
                data['enlace'] = f'https://{enlace}'

        return super().to_internal_value(data)

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