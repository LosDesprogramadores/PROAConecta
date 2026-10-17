import pytest
from channels.db import database_sync_to_async
from channels.routing import URLRouter
# channels.testing.__init__ importa daphne (solo para el servidor en vivo); el comunicador no lo necesita
from channels.testing import WebsocketCommunicator
from django.core.cache import cache

from notificacion import tickets
from notificacion.middleware import TicketAuthMiddleware
from notificacion.routing import websocket_urlpatterns
from proa.asgi import application

URL_TICKET = '/api/ws/ticket/'
RUTA_WS = '/ws/notificaciones/'

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def cache_limpia():
    cache.clear()
    yield
    cache.clear()


def _app():
    return TicketAuthMiddleware(URLRouter(websocket_urlpatterns))


async def _conectar(query=''):
    comunicador = WebsocketCommunicator(_app(), f'{RUTA_WS}{query}')
    conectado, _ = await comunicador.connect()
    return comunicador, conectado


async def _debe_cerrar_con_4401(comunicador, conectado):
    # Se acepta el handshake y se cierra con 4401 para que el navegador reciba el código
    assert conectado is True
    salida = await comunicador.receive_output(timeout=1)
    assert salida['type'] == 'websocket.close'
    assert salida['code'] == 4401


def test_endpoint_de_ticket_rechaza_anonimos(cliente_anonimo):
    assert cliente_anonimo.post(URL_TICKET).status_code == 401


def test_endpoint_de_ticket_devuelve_un_uuid_de_30_segundos(api_as, estudiante):
    respuesta = api_as(estudiante).post(URL_TICKET)
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo['expira_en'] == 30
    assert tickets.canjear(cuerpo['ticket']).pk == estudiante.pk


def test_endpoint_de_ticket_solo_acepta_post(api_as, estudiante):
    assert api_as(estudiante).get(URL_TICKET).status_code == 405


async def test_sin_ticket_cierra_con_4401():
    comunicador, conectado = await _conectar()
    await _debe_cerrar_con_4401(comunicador, conectado)


async def test_ticket_inexistente_cierra_con_4401():
    comunicador, conectado = await _conectar('?ticket=no-existe')
    await _debe_cerrar_con_4401(comunicador, conectado)


async def test_ticket_valido_conecta(estudiante):
    ticket = await _emitir(estudiante)
    comunicador, conectado = await _conectar(f'?ticket={ticket}')
    assert conectado is True
    await comunicador.disconnect()


async def test_ticket_reusado_cierra_con_4401(estudiante):
    ticket = await _emitir(estudiante)
    primero, conectado = await _conectar(f'?ticket={ticket}')
    assert conectado is True
    await primero.disconnect()

    segundo, conectado = await _conectar(f'?ticket={ticket}')
    await _debe_cerrar_con_4401(segundo, conectado)


async def test_ticket_vencido_cierra_con_4401(estudiante):
    ticket = await _emitir(estudiante)
    # El vencimiento por TTL equivale a que la clave ya no exista en la caché
    cache.delete(f'ws_ticket:{ticket}')
    comunicador, conectado = await _conectar(f'?ticket={ticket}')
    await _debe_cerrar_con_4401(comunicador, conectado)


async def test_ticket_de_usuario_inactivo_cierra_con_4401(estudiante):
    ticket = await _emitir(estudiante)
    estudiante.is_active = False
    await _guardar(estudiante)
    comunicador, conectado = await _conectar(f'?ticket={ticket}')
    await _debe_cerrar_con_4401(comunicador, conectado)


async def test_origen_no_permitido_se_rechaza(estudiante):
    ticket = await _emitir(estudiante)
    comunicador = WebsocketCommunicator(
        application, f'{RUTA_WS}?ticket={ticket}', headers=[(b'origin', b'http://sitio-malo.test')]
    )
    conectado, _ = await comunicador.connect()
    assert conectado is False


async def test_origen_permitido_conecta(estudiante):
    ticket = await _emitir(estudiante)
    comunicador = WebsocketCommunicator(
        application, f'{RUTA_WS}?ticket={ticket}', headers=[(b'origin', b'http://localhost:4200')]
    )
    conectado, _ = await comunicador.connect()
    assert conectado is True
    await comunicador.disconnect()


# Helpers síncronos envueltos para usarlos desde tests async
@database_sync_to_async
def _emitir(usuario):
    return tickets.emitir(usuario)


@database_sync_to_async
def _guardar(usuario):
    usuario.save()
