"""Envíos a servicios externos (SMTP, Discord) fuera del ciclo del request.

Una demora o una caída del servicio externo no debe hacer lenta la respuesta ni dejar datos a
medias. ``ejecutar_en_segundo_plano`` espera a que la transacción se confirme (``transaction.on_commit``)
y recién entonces entrega la tarea a un hilo. Un fallo se registra y, si el llamador lo pide, se avisa
por ``al_fallar``; nunca llega al request.

Límites conocidos: no hay reintentos ni persistencia. Si el proceso se cae con envíos pendientes se
pierden (la cola real queda fuera de alcance: 003/T060-T067).
"""
import logging
import threading
from concurrent.futures import ThreadPoolExecutor

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)

TRABAJADORES = 4
_ejecutor = None
_candado = threading.Lock()


def _obtener_ejecutor():
    global _ejecutor
    if _ejecutor is None:
        with _candado:
            if _ejecutor is None:
                _ejecutor = ThreadPoolExecutor(max_workers=TRABAJADORES, thread_name_prefix='fondo')
    return _ejecutor


def ejecutar_en_segundo_plano(tarea, *, descripcion, al_fallar=None):
    """Programa ``tarea`` (sin argumentos) para después del commit.

    ``descripcion`` es lo único que se escribe en el log junto con el tipo de error: no debe llevar
    datos personales ni secretos. ``tarea`` y ``al_fallar`` corren en otro hilo: no deben usar el ORM
    ni el ``request`` (pasarles solo datos simples ya leídos).
    """
    transaction.on_commit(lambda: _despachar(tarea, descripcion, al_fallar))


def _despachar(tarea, descripcion, al_fallar):
    # Los tests corren los envíos en línea (SEGUNDO_PLANO_SINCRONO) para ser deterministas
    if getattr(settings, 'SEGUNDO_PLANO_SINCRONO', False):
        _correr(tarea, descripcion, al_fallar)
    else:
        _obtener_ejecutor().submit(_correr, tarea, descripcion, al_fallar)


def _correr(tarea, descripcion, al_fallar):
    try:
        tarea()
    except Exception as error:
        logger.error('Falló el envío en segundo plano: %s (%s)', descripcion, type(error).__name__, exc_info=True)
        if al_fallar is not None:
            try:
                al_fallar(error)
            except Exception:
                logger.exception('Falló el aviso del error de: %s', descripcion)
