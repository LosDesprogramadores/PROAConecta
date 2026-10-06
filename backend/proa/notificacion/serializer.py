from rest_framework import serializers

ALCANCES = ('AMBOS', 'TODOS', 'ESTUDIANTE', 'ESTUDIANTES', 'PROFESOR', 'PROFESORES')
TIPOS = ('GENERAL', 'ANUNCIO', 'ACADEMICO', 'URGENTE')


class EnteroOpcionalField(serializers.IntegerField):
    # El frontend envía '' para "sin valor": se normaliza a None antes de validar
    def run_validation(self, data=serializers.empty):
        if data == '':
            data = None
        return super().run_validation(data)


class NotificacionEntradaSerializer(serializers.Serializer):
    """Valida el alta y la edición de un aviso. El autor nunca se toma del cuerpo."""

    titulo = serializers.CharField(max_length=120)
    mensaje = serializers.CharField(max_length=2000)
    tipo_notificacion_codigo = serializers.ChoiceField(choices=TIPOS, default='GENERAL')
    alcance = serializers.ChoiceField(choices=ALCANCES, default='AMBOS')
    materia_id = EnteroOpcionalField(required=False, allow_null=True)
    usuario_destino_id = EnteroOpcionalField(required=False, allow_null=True)
    fecha_desde = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=40)
    fecha_hasta = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=40)

    def validate(self, attrs):
        # Las fechas vacías se guardan como "sin vigencia"
        for campo in ('fecha_desde', 'fecha_hasta'):
            if attrs.get(campo) == '':
                attrs[campo] = None
        return attrs


class AnuncioEntradaSerializer(serializers.Serializer):
    """Cuerpo de un anuncio de materia. Solo título y mensaje: el autor sale de la sesión y el tipo, el
    alcance y la materia los fija el servidor (cualquier otro campo del cuerpo se ignora)."""

    titulo = serializers.CharField(
        max_length=120,
        error_messages={
            'required': 'Este campo es obligatorio.',
            'null': 'Este campo es obligatorio.',
            'blank': 'Este campo no puede estar vacío.',
            'max_length': 'Máximo {max_length} caracteres.',
        },
    )
    mensaje = serializers.CharField(
        max_length=2000,
        error_messages={
            'required': 'Este campo es obligatorio.',
            'null': 'Este campo es obligatorio.',
            'blank': 'Este campo no puede estar vacío.',
            'max_length': 'Máximo {max_length} caracteres.',
        },
    )
