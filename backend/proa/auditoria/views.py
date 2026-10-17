import logging

from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from pymongo.errors import PyMongoError
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import ErrorSerializer
from core.permissions import EsAdministrador

from . import bitacora

logger = logging.getLogger(__name__)

SIN_SERVICIO = {'detail': 'Servicio de auditoría no disponible.'}

EVENTOS_SALIDA = inline_serializer('EventosAuditoria', {
    'count': serializers.IntegerField(),
    'next': serializers.CharField(allow_null=True),
    'previous': serializers.CharField(allow_null=True),
    'results': inline_serializer('EventoAuditoria', {
        'id': serializers.CharField(),
        'fecha': serializers.CharField(),
        'actor': inline_serializer('ActorAuditoria', {
            'id': serializers.IntegerField(),
            'nombre_completo': serializers.CharField(allow_null=True),
            'rol': serializers.CharField(allow_null=True),
        }, allow_null=True),
        'tipo': serializers.CharField(),
        'entidad': serializers.CharField(allow_null=True),
        'entidad_id': serializers.IntegerField(allow_null=True),
        'materia_id': serializers.IntegerField(allow_null=True),
        'datos': serializers.DictField(),
    }, many=True),
})


class EventosAuditoriaView(APIView):
    permission_classes = [EsAdministrador]

    @extend_schema(
        summary='Eventos de la bitácora de auditoría',
        parameters=[OpenApiParameter(n, t) for n, t in (
            ('tipo', str), ('entidad', str), ('entidad_id', int), ('actor_id', int), ('materia_id', int),
            ('desde', str), ('hasta', str), ('page', int), ('page_size', int),
        )],
        responses={200: EVENTOS_SALIDA, 400: ErrorSerializer, 403: ErrorSerializer, 503: ErrorSerializer},
    )
    def get(self, request):
        try:
            datos = bitacora.listar(request.query_params, request.path)
        except PyMongoError:
            logger.exception('Mongo no disponible al listar la bitácora')
            return Response(SIN_SERVICIO, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(datos, status=status.HTTP_200_OK)
