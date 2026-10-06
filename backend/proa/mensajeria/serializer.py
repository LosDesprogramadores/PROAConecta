from rest_framework import serializers


class MensajeEntradaSerializer(serializers.Serializer):
    materia_id = serializers.IntegerField(min_value=1)
    destinatario_id = serializers.IntegerField(min_value=1)
    # Texto plano: se escapa al renderizar. trim_whitespace rechaza el cuerpo de solo espacios
    asunto = serializers.CharField(min_length=1, max_length=120)
    cuerpo = serializers.CharField(min_length=1, max_length=2000)


class PersonaMensajeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre_completo = serializers.CharField(allow_null=True)


class MateriaMensajeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField(allow_null=True)


class MensajeSalidaSerializer(serializers.Serializer):
    """Forma documentada (OpenAPI) de un mensaje; la salida real la arma services.serializar."""

    id = serializers.CharField()
    materia = MateriaMensajeSerializer()
    remitente = PersonaMensajeSerializer()
    destinatario = PersonaMensajeSerializer()
    asunto = serializers.CharField()
    cuerpo = serializers.CharField()
    fecha_creacion = serializers.CharField()
    leido = serializers.BooleanField()


class DestinatarioSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre_completo = serializers.CharField()
    rol = serializers.ChoiceField(choices=['ESTUDIANTE', 'PROFESOR'])
