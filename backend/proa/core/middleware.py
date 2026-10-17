import time

from django.conf import settings
from django.core.exceptions import MiddlewareNotUsed
from django.db import connection


class _ContadorDeConsultas:
    # execute_wrapper recibe cada sentencia SQL del hilo: sirve para contar sin guardar el texto
    def __init__(self):
        self.total = 0

    def __call__(self, execute, sql, params, many, context):
        self.total += 1
        return execute(sql, params, many, context)


class MedicionMiddleware:
    """Agrega ``X-Query-Count`` y ``X-Response-Time-ms`` a cada respuesta.

    Es una herramienta de desarrollo: solo se activa con ``DEBUG`` (settings.py lo agrega a
    ``MIDDLEWARE`` únicamente en ese caso y, por las dudas, se desactiva sola si ``DEBUG`` es falso).
    """

    def __init__(self, get_response):
        if not settings.DEBUG:
            raise MiddlewareNotUsed('La medición de consultas solo corre con DEBUG.')
        self.get_response = get_response

    def __call__(self, request):
        contador = _ContadorDeConsultas()
        inicio = time.perf_counter()
        with connection.execute_wrapper(contador):
            respuesta = self.get_response(request)
        respuesta['X-Query-Count'] = str(contador.total)
        respuesta['X-Response-Time-ms'] = f'{(time.perf_counter() - inicio) * 1000:.1f}'
        return respuesta
