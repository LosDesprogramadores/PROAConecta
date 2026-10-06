"""EXCEPTION_HANDLER de toda la API: un solo formato de error.

* ``{"detail": "texto"}`` para errores generales (permisos, no encontrado, reglas de negocio).
* ``{"campo": ["texto", ...]}`` para errores de validación por campo (siempre listas).
* Ambos pueden convivir: ``{"detail": "...", "campo": ["..."]}``.

Nunca sale un traceback ni ``str(excepción)``: un error inesperado responde un 500 genérico y el
detalle técnico va solo al log.
"""
import logging

from django.db.models import ProtectedError, RestrictedError
from rest_framework import exceptions, serializers, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as manejador_de_drf
from rest_framework.views import set_rollback

logger = logging.getLogger(__name__)

MENSAJE_JSON_INVALIDO = 'El cuerpo de la solicitud no es válido.'
MENSAJE_PROTEGIDO = 'No se puede eliminar: hay registros que dependen de este.'
MENSAJE_INTERNO = 'Ocurrió un error interno. Intenta nuevamente más tarde.'

# DRF agrupa los errores generales de un serializer bajo esta clave; el contrato los quiere en `detail`
CLAVES_GENERALES = ('detail', 'non_field_errors')


def _textos(valor):
    if isinstance(valor, (list, tuple)):
        return [texto for elemento in valor for texto in _textos(elemento)]
    if isinstance(valor, dict):
        return [texto for elemento in valor.values() for texto in _textos(elemento)]
    return [str(valor)]


def _como_lista(valor):
    # Un campo siempre informa una lista, aunque la vista haya levantado un texto suelto
    if isinstance(valor, dict):
        return {clave: _como_lista(elemento) for clave, elemento in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [_como_lista(elemento) if isinstance(elemento, dict) else elemento for elemento in valor]
    return [valor]


def _normalizar_validacion(datos):
    if not isinstance(datos, dict):
        return {'detail': ' '.join(_textos(datos))}
    generales = [texto for clave in CLAVES_GENERALES for texto in _textos(datos.get(clave, []))]
    normalizado = {'detail': ' '.join(generales)} if generales else {}
    for campo, valor in datos.items():
        if campo not in CLAVES_GENERALES:
            normalizado[campo] = _como_lista(valor)
    return normalizado


def manejador_de_excepciones(exc, contexto):
    if isinstance(exc, (ProtectedError, RestrictedError)):
        set_rollback()
        return Response({'detail': MENSAJE_PROTEGIDO}, status=status.HTTP_409_CONFLICT)

    if isinstance(exc, exceptions.ParseError):
        # El mensaje del parser incluye el texto del error de JSON: no se muestra
        exc = exceptions.ParseError(MENSAJE_JSON_INVALIDO)

    respuesta = manejador_de_drf(exc, contexto)
    if respuesta is None:
        set_rollback()
        peticion = (contexto or {}).get('request')
        logger.error(
            'Error no controlado en %s %s', getattr(peticion, 'method', '?'), getattr(peticion, 'path', '?'),
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        return Response({'detail': MENSAJE_INTERNO}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if isinstance(exc, exceptions.ValidationError):
        respuesta.data = _normalizar_validacion(respuesta.data)
    return respuesta


class ErrorSerializer(serializers.Serializer):
    """Forma documentada (OpenAPI) del error general. Los errores por campo usan ``{campo: [texto]}``."""

    detail = serializers.CharField()
