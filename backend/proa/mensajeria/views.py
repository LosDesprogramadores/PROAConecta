import logging

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from pymongo.errors import PyMongoError
from rest_framework import serializers, status
from rest_framework.exceptions import Throttled
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academico.models import Materia
from core.exceptions import ErrorSerializer
from core.throttling import MensajesThrottle
from notificacion.tiempo_real import grupo_usuario, publicar

from . import services
from .serializer import DestinatarioSerializer, MensajeEntradaSerializer, MensajeSalidaSerializer

# Nunca se registra el asunto ni el cuerpo: solo ids y el tipo de error
logger = logging.getLogger(__name__)

SIN_SERVICIO = {'detail': 'Servicio de mensajes no disponible.'}

MENSAJES_SALIDA = inline_serializer('MensajesPagina', {
    'count': serializers.IntegerField(),
    'next': serializers.CharField(allow_null=True),
    'previous': serializers.CharField(allow_null=True),
    'results': MensajeSalidaSerializer(many=True),
    'no_leidos': serializers.IntegerField(),
})


def _sin_servicio():
    return Response(SIN_SERVICIO, status=status.HTTP_503_SERVICE_UNAVAILABLE)


def _publicar(usuario_id, tipo, datos, mensaje_id):
    # El mensaje ya está guardado: un fallo del tiempo real no debe devolver error
    try:
        publicar(grupo_usuario(usuario_id), tipo, datos)
    except Exception:
        logger.warning('No se pudo publicar %s del mensaje %s en tiempo real', tipo, mensaje_id, exc_info=True)


class MensajeListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        # Solo el envío tiene límite (30/min por usuario); listar no
        return [MensajesThrottle()] if self.request.method == 'POST' else []

    def throttled(self, request, wait):
        raise Throttled(wait, detail='Enviaste demasiados mensajes. Intentá de nuevo en un momento.')

    @extend_schema(
        summary='Bandeja de mensajes del usuario',
        parameters=[
            OpenApiParameter('bandeja', str, enum=['recibidos', 'enviados']),
            OpenApiParameter('materia', int),
            OpenApiParameter('no_leidos', bool),
            OpenApiParameter('page', int),
            OpenApiParameter('page_size', int),
        ],
        responses={200: MENSAJES_SALIDA, 400: ErrorSerializer, 403: ErrorSerializer, 503: ErrorSerializer},
    )
    def get(self, request):
        try:
            datos = services.listar(request.user, request.query_params, request.path)
        except PyMongoError:
            logger.exception('Mongo no disponible al listar mensajes')
            return _sin_servicio()
        return Response(datos, status=status.HTTP_200_OK)

    @extend_schema(
        summary='Enviar un mensaje al profesor titular o a un inscripto de la materia',
        request=MensajeEntradaSerializer,
        responses={201: MensajeSalidaSerializer, 400: ErrorSerializer, 403: ErrorSerializer,
                   404: ErrorSerializer, 503: ErrorSerializer},
    )
    def post(self, request):
        entrada = MensajeEntradaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        try:
            documento = services.enviar(
                request.user, datos['materia_id'], datos['destinatario_id'], datos['asunto'], datos['cuerpo']
            )
        except PyMongoError:
            logger.exception('Mongo no disponible al enviar un mensaje')
            return _sin_servicio()

        mensaje = services.serializar([documento])[0]
        _publicar(documento['destinatario_id'], 'mensaje.nuevo', mensaje, mensaje['id'])
        return Response(mensaje, status=status.HTTP_201_CREATED)


class MensajeLeerView(APIView):
    """Solo el destinatario. Idempotente; avisa al remitente con ``mensaje.leido``."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Marcar un mensaje recibido como leído',
        request=None,
        responses={200: inline_serializer('MensajeLeido', {'id': serializers.CharField(), 'leido': serializers.BooleanField()}),
                   404: ErrorSerializer, 503: ErrorSerializer},
    )
    def post(self, request, pk):
        try:
            documento = services.marcar_leido(request.user, pk)
        except PyMongoError:
            logger.exception('Mongo no disponible al marcar un mensaje como leído')
            return _sin_servicio()
        datos = {'id': str(documento['_id']), 'leido': True}
        _publicar(documento['remitente_id'], 'mensaje.leido', datos, datos['id'])
        return Response(datos, status=status.HTTP_200_OK)


class MensajeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Eliminar un mensaje propio (dentro de los 15 minutos del envío)',
        responses={204: None, 400: ErrorSerializer, 404: ErrorSerializer, 503: ErrorSerializer},
    )
    def delete(self, request, pk):
        try:
            services.eliminar(request.user, pk)
        except PyMongoError:
            logger.exception('Mongo no disponible al eliminar un mensaje')
            return _sin_servicio()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DestinatariosView(APIView):
    """A quién puede escribirle el usuario en la materia: inscriptos (titular) o el titular (estudiante)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Destinatarios posibles de un mensaje en la materia',
        responses={200: DestinatarioSerializer(many=True), 403: ErrorSerializer, 404: ErrorSerializer},
    )
    def get(self, request, materia_id):
        materia = get_object_or_404(Materia, pk=materia_id)
        return Response(services.destinatarios(request.user, materia), status=status.HTTP_200_OK)
