"""El destinatario recibe ``mensaje.nuevo`` por el WebSocket real al enviar por REST (C6)."""
import pytest
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.core.cache import cache

from notificacion import mongo, tickets
from notificacion.middleware import TicketAuthMiddleware
from notificacion.routing import websocket_urlpatterns

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def limpio():
    cache.clear()
    mongo.obtener_coleccion(mongo.COLECCION_MENSAJE).delete_many({})
    yield
    cache.clear()
    mongo.obtener_coleccion(mongo.COLECCION_MENSAJE).delete_many({})


async def _conectar(usuario):
    ticket = await database_sync_to_async(tickets.emitir)(usuario)
    comunicador = WebsocketCommunicator(
        TicketAuthMiddleware(URLRouter(websocket_urlpatterns)), f'/ws/notificaciones/?ticket={ticket}'
    )
    conectado, _ = await comunicador.connect()
    assert conectado is True
    return comunicador


async def test_destinatario_recibe_mensaje_nuevo_y_el_remitente_mensaje_leido(
    api_as, materia_con_inscripcion, profesor, estudiante
):
    destino = await _conectar(estudiante)
    origen = await _conectar(profesor)
    payload = {
        'materia_id': materia_con_inscripcion.pk, 'destinatario_id': estudiante.pk,
        'asunto': 'Consulta', 'cuerpo': 'Hola',
    }

    respuesta = await sync_to_async(api_as(profesor).post)('/api/mensajes/', payload, format='json')
    assert respuesta.status_code == 201

    evento = await destino.receive_json_from(timeout=1)
    assert evento['tipo'] == 'mensaje.nuevo'
    assert evento['datos'] == respuesta.json()
    assert await origen.receive_nothing(timeout=0.3) is True  # el remitente no recibe su propio envío

    leido = await sync_to_async(api_as(estudiante).post)(f'/api/mensajes/{respuesta.json()["id"]}/leer/')
    assert leido.status_code == 200
    evento = await origen.receive_json_from(timeout=1)
    assert evento['tipo'] == 'mensaje.leido'
    assert evento['datos'] == {'id': respuesta.json()['id'], 'leido': True}
    await destino.disconnect()
    await origen.disconnect()
