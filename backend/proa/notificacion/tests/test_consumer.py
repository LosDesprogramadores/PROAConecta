import asyncio

import pytest
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.core.cache import cache

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from notificacion import tickets
from notificacion.middleware import TicketAuthMiddleware
from notificacion.routing import websocket_urlpatterns
from notificacion.tiempo_real import publicar
from usuario.tests.factories import UsuarioFactory

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def cache_limpia():
    cache.clear()
    yield
    cache.clear()


@database_sync_to_async
def _emitir(usuario):
    return tickets.emitir(usuario)


async def _conectar(usuario):
    ticket = await _emitir(usuario)
    comunicador = WebsocketCommunicator(
        TicketAuthMiddleware(URLRouter(websocket_urlpatterns)), f'/ws/notificaciones/?ticket={ticket}'
    )
    conectado, _ = await comunicador.connect()
    assert conectado is True
    return comunicador


async def _publicar(grupo, tipo, datos):
    await sync_to_async(publicar)(grupo, tipo, datos)


async def _no_recibe_nada(comunicador):
    assert await comunicador.receive_nothing(timeout=0.3) is True


async def test_estudiante_recibe_eventos_de_su_materia(materia_con_inscripcion, estudiante):
    comunicador = await _conectar(estudiante)
    await _publicar(f'materia_{materia_con_inscripcion.id}', 'anuncio.creado', {'titulo': 'Hola'})

    mensaje = await comunicador.receive_json_from(timeout=1)
    assert mensaje['tipo'] == 'anuncio.creado'
    assert mensaje['datos'] == {'titulo': 'Hola'}
    assert mensaje['fecha']
    await comunicador.disconnect()


async def test_estudiante_no_recibe_eventos_de_otra_materia(materia_con_inscripcion, estudiante):
    otra = await database_sync_to_async(MateriaFactory)()
    comunicador = await _conectar(estudiante)

    await _publicar(f'materia_{otra.id}', 'anuncio.creado', {'titulo': 'Ajeno'})
    await _publicar(f'materia_{materia_con_inscripcion.id}', 'anuncio.creado', {'titulo': 'Propio'})

    mensaje = await comunicador.receive_json_from(timeout=1)
    assert mensaje['datos'] == {'titulo': 'Propio'}
    await _no_recibe_nada(comunicador)
    await comunicador.disconnect()


async def test_estudiante_dado_de_baja_no_se_une_a_la_materia(materia_con_inscripcion, estudiante):
    await database_sync_to_async(
        Inscripcion.objects.filter(materia=materia_con_inscripcion, estudiante=estudiante.persona).update
    )(estado=Inscripcion.EstadoInscripcion.BAJA)
    comunicador = await _conectar(estudiante)

    await _publicar(f'materia_{materia_con_inscripcion.id}', 'anuncio.creado', {'titulo': 'Nada'})
    await _no_recibe_nada(comunicador)
    await comunicador.disconnect()


async def test_estudiante_libre_sigue_recibiendo_eventos(materia_con_inscripcion, estudiante):
    await database_sync_to_async(
        Inscripcion.objects.filter(materia=materia_con_inscripcion, estudiante=estudiante.persona).update
    )(estado=Inscripcion.EstadoInscripcion.LIBRE)
    comunicador = await _conectar(estudiante)

    await _publicar(f'materia_{materia_con_inscripcion.id}', 'anuncio.creado', {'titulo': 'Libre'})
    assert (await comunicador.receive_json_from(timeout=1))['datos'] == {'titulo': 'Libre'}
    await comunicador.disconnect()


async def test_profesor_titular_recibe_eventos_de_su_materia(materia_con_inscripcion, profesor):
    comunicador = await _conectar(profesor)

    await _publicar(f'materia_{materia_con_inscripcion.id}', 'anuncio.creado', {'titulo': 'Para docentes'})
    assert (await comunicador.receive_json_from(timeout=1))['datos'] == {'titulo': 'Para docentes'}
    await comunicador.disconnect()


async def test_usuario_recibe_eventos_de_su_grupo_personal(estudiante, rol_estudiante):
    otro = await database_sync_to_async(UsuarioFactory)(persona__rol=rol_estudiante)
    propio = await _conectar(estudiante)
    ajeno = await _conectar(otro)

    await _publicar(f'usuario_{estudiante.pk}', 'mensaje.nuevo', {'id': 'm1'})

    mensaje = await propio.receive_json_from(timeout=1)
    assert mensaje['tipo'] == 'mensaje.nuevo'
    assert mensaje['datos'] == {'id': 'm1'}
    await _no_recibe_nada(ajeno)
    await propio.disconnect()
    await ajeno.disconnect()


async def test_el_grupo_global_ya_no_existe(estudiante):
    comunicador = await _conectar(estudiante)

    await _publicar('notificaciones_globales', 'anuncio.creado', {'titulo': 'Global'})
    await _no_recibe_nada(comunicador)
    await comunicador.disconnect()


async def test_ping_responde_pong(estudiante):
    comunicador = await _conectar(estudiante)

    await comunicador.send_json_to({'tipo': 'ping'})
    assert await comunicador.receive_json_from(timeout=1) == {'tipo': 'pong'}
    await comunicador.disconnect()


async def test_mensajes_de_negocio_del_cliente_se_ignoran(estudiante):
    comunicador = await _conectar(estudiante)

    await comunicador.send_json_to({'tipo': 'anuncio.creado', 'datos': {}})
    await comunicador.send_to(text_data='no es json')
    await _no_recibe_nada(comunicador)
    await comunicador.disconnect()


async def test_desconectar_libera_los_grupos(materia_con_inscripcion, estudiante):
    comunicador = await _conectar(estudiante)
    await comunicador.disconnect()

    # Publicar sin miembros no debe fallar ni dejar tareas colgadas
    await _publicar(f'materia_{materia_con_inscripcion.id}', 'anuncio.creado', {})
    await asyncio.sleep(0)


async def test_crear_notificacion_de_materia_llega_a_la_materia(materia_con_inscripcion, estudiante, admin, api_as):
    comunicador = await _conectar(estudiante)
    cliente = api_as(admin)

    respuesta = await sync_to_async(cliente.post)(
        '/api/notificaciones/',
        {'titulo': 'Parcial', 'mensaje': 'Jueves', 'materia_id': materia_con_inscripcion.id},
        format='json',
    )
    assert respuesta.status_code == 201

    mensaje = await comunicador.receive_json_from(timeout=1)
    assert mensaje['tipo'] == 'notificacion.creada'
    assert mensaje['datos']['titulo'] == 'Parcial'
    await comunicador.disconnect()


async def test_crear_notificacion_personal_llega_solo_al_destinatario(estudiante, profesor, admin, api_as):
    destinatario = await _conectar(estudiante)
    otro = await _conectar(profesor)
    cliente = api_as(admin)

    respuesta = await sync_to_async(cliente.post)(
        '/api/notificaciones/',
        {'titulo': 'Aviso', 'mensaje': 'Hola', 'usuario_destino_id': estudiante.pk},
        format='json',
    )
    assert respuesta.status_code == 201

    assert (await destinatario.receive_json_from(timeout=1))['datos']['titulo'] == 'Aviso'
    await _no_recibe_nada(otro)
    await destinatario.disconnect()
    await otro.disconnect()
