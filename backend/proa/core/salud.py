"""Endpoint de salud para los healthchecks (009/T022, FR-019).

Política de códigos:
- PostgreSQL caído -> 503 y estado "caido": sin base relacional nada funciona.
- MongoDB o Redis caídos -> 200 y estado "degradado": la API sigue atendiendo, pero se pierden
  bitácora/notificaciones o la caché compartida. El detalle sale en ``servicios``.
- Redis sin REDIS_URL -> "no_configurado" y no cuenta como falla.

La respuesta nunca incluye versiones, hosts ni mensajes de error: en el servidor solo se registra la clase de la excepción.
El resultado se cachea unos segundos en el proceso (TTL_SEGUNDOS).
Sin throttle: es un pedido barato que el orquestador repite cada pocos segundos y un límite lo volvería
un falso negativo; no expone datos.
"""
import logging
import threading
import time

import pymongo
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

# Corto a propósito: el healthcheck no puede quedar colgado esperando a un Mongo caído
MONGO_TIMEOUT_MS = 2000
# El resultado completo se reutiliza este tiempo: una ráfaga de pedidos no se amplifica en pings a las bases
TTL_SEGUNDOS = 5

ESTADOS = ('ok', 'degradado', 'caido')

_lock = threading.Lock()
_cache = None  # (instante monotónico, servicios) del último chequeo
_cliente_mongo = None


def reiniciar():
    """Descarta el resultado en caché y el cliente de Mongo (para tests)."""
    global _cache, _cliente_mongo
    with _lock:
        _cache = None
        if _cliente_mongo is not None:
            _cliente_mongo.close()
        _cliente_mongo = None


def _postgres():
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        return 'ok'
    except Exception as exc:
        logger.warning('Healthcheck: PostgreSQL no responde (%s)', type(exc).__name__)
        return 'error'


def _mongo():
    # Un único cliente propio con timeout corto, creado en el primer uso y reutilizado entre pedidos:
    # no se toca el cliente global (5 s) de notificacion.mongo. Se llama con _lock tomado.
    global _cliente_mongo
    try:
        if _cliente_mongo is None:
            _cliente_mongo = pymongo.MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=MONGO_TIMEOUT_MS)
        _cliente_mongo.admin.command('ping')
        return 'ok'
    except Exception as exc:
        logger.warning('Healthcheck: MongoDB no responde (%s)', type(exc).__name__)
        return 'error'


def _redis():
    if not settings.REDIS_URL:
        return 'no_configurado'
    try:
        cache.set('salud:ping', '1', timeout=5)
        if cache.get('salud:ping') != '1':
            raise RuntimeError('la caché no devolvió el valor escrito')
        return 'ok'
    except Exception as exc:
        logger.warning('Healthcheck: Redis no responde (%s)', type(exc).__name__)
        return 'error'


def _servicios():
    # Con el lock tomado el resto de los pedidos espera el resultado en vez de repetir los chequeos
    global _cache
    with _lock:
        ahora = time.monotonic()
        if _cache is None or ahora - _cache[0] >= TTL_SEGUNDOS:
            servicios = {'postgres': _postgres(), 'mongo': _mongo(), 'redis': _redis()}
            _cache = (time.monotonic(), servicios)
        return dict(_cache[1])


def _estado(servicios):
    if servicios['postgres'] != 'ok':
        return 'caido'
    if servicios['mongo'] != 'ok' or servicios['redis'] == 'error':
        return 'degradado'
    return 'ok'


class SaludView(APIView):
    """Estado de PostgreSQL, MongoDB y Redis. Público y sin credenciales."""
    permission_classes = [AllowAny]
    # Sin autenticación: ni un JWT inválido ni el cambio de clave pendiente deben tumbar el healthcheck
    authentication_classes = []
    throttle_classes = []

    @extend_schema(
        summary='Estado de los servicios',
        description='200 con estado "ok" o "degradado" (MongoDB o Redis caídos); 503 con estado "caido" si PostgreSQL falla.',
        responses={
            200: inline_serializer('Salud', {
                'estado': serializers.ChoiceField(choices=ESTADOS),
                'servicios': serializers.DictField(child=serializers.CharField()),
            }),
            503: inline_serializer('SaludCaido', {
                'estado': serializers.ChoiceField(choices=ESTADOS),
                'servicios': serializers.DictField(child=serializers.CharField()),
            }),
        },
        auth=[],
    )
    def get(self, request):
        servicios = _servicios()
        estado = _estado(servicios)
        codigo = status.HTTP_503_SERVICE_UNAVAILABLE if estado == 'caido' else status.HTTP_200_OK
        return Response({'estado': estado, 'servicios': servicios}, status=codigo)
