"""Endpoints de mensajes (C3, C6, TSK150): matriz de roles, bandejas y eventos en vivo."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from pymongo.errors import PyMongoError

from academico.tests.factories import InscripcionFactory
from mensajeria import repositorio
from notificacion import mongo
from usuario.tests.factories import UsuarioFactory

pytestmark = pytest.mark.django_db

MENSAJES = '/api/mensajes/'


@pytest.fixture(autouse=True)
def coleccion_vacia():
    coleccion = mongo.obtener_coleccion(mongo.COLECCION_MENSAJE)
    coleccion.delete_many({})
    yield
    coleccion.delete_many({})


@pytest.fixture
def profesor_ajeno(rol_profesor):
    return UsuarioFactory(persona__rol=rol_profesor)


@pytest.fixture
def estudiante_ajeno(rol_estudiante):
    return UsuarioFactory(persona__rol=rol_estudiante)


def destinatarios_url(materia):
    return f'/api/materias/{materia.pk}/destinatarios/'


def cuerpo(materia, destinatario, **extra):
    return {
        'materia_id': materia.pk, 'destinatario_id': destinatario.pk,
        'asunto': 'Consulta TP 2', 'cuerpo': '¿El ejercicio 3 entra en el parcial?', **extra,
    }


def _guardar(materia, remitente, destinatario, minutos=0, **extra):
    id_, _ = repositorio.crear({
        'materia_id': materia.pk, 'remitente_id': remitente.pk, 'destinatario_id': destinatario.pk,
        'asunto': 'A', 'cuerpo': 'C', 'leido': False, 'fecha_baja': None,
        'fecha_creacion': datetime.now(timezone.utc) + timedelta(minutes=minutos), **extra,
    })
    return str(id_)


# --- Matriz de roles ---

@pytest.mark.parametrize('quien,esperado', [
    ('admin', 403), ('profesor', 200), ('profesor_ajeno', 403),
    ('estudiante', 200), ('estudiante_ajeno', 403), (None, 401),
])
def test_destinatarios_matriz(api_as, cliente_anonimo, request, materia_con_inscripcion, quien, esperado):
    cliente = api_as(request.getfixturevalue(quien)) if quien else cliente_anonimo

    assert cliente.get(destinatarios_url(materia_con_inscripcion)).status_code == esperado


def test_destinatarios_del_profesor_lista_inscriptos_sin_datos_personales(
    api_as, materia_con_inscripcion, profesor, estudiante
):
    respuesta = api_as(profesor).get(destinatarios_url(materia_con_inscripcion)).json()

    assert respuesta == [{
        'id': estudiante.pk,
        'nombre_completo': f'{estudiante.persona.apellido}, {estudiante.persona.nombre}',
        'rol': 'ESTUDIANTE',
    }]


def test_destinatarios_de_materia_inexistente_es_404(api_as, profesor):
    assert api_as(profesor).get('/api/materias/999999/destinatarios/').status_code == 404


@pytest.mark.parametrize('quien,esperado', [
    ('admin', 403), ('profesor', 201), ('profesor_ajeno', 403), ('estudiante_ajeno', 403), (None, 401),
])
def test_enviar_a_estudiante_inscripto_matriz(
    api_as, cliente_anonimo, request, materia_con_inscripcion, estudiante, quien, esperado
):
    cliente = api_as(request.getfixturevalue(quien)) if quien else cliente_anonimo

    respuesta = cliente.post(MENSAJES, cuerpo(materia_con_inscripcion, estudiante), format='json')

    assert respuesta.status_code == esperado


@pytest.mark.parametrize('quien,esperado', [
    ('admin', 403), ('estudiante', 201), ('estudiante_ajeno', 403), (None, 401),
])
def test_enviar_a_profesor_titular_matriz(
    api_as, cliente_anonimo, request, materia_con_inscripcion, profesor, quien, esperado
):
    cliente = api_as(request.getfixturevalue(quien)) if quien else cliente_anonimo

    respuesta = cliente.post(MENSAJES, cuerpo(materia_con_inscripcion, profesor), format='json')

    assert respuesta.status_code == esperado


def test_par_rechazado_responde_detail_y_no_guarda(api_as, materia_con_inscripcion, estudiante, estudiante_ajeno):
    InscripcionFactory(materia=materia_con_inscripcion, estudiante=estudiante_ajeno.persona)

    respuesta = api_as(estudiante).post(MENSAJES, cuerpo(materia_con_inscripcion, estudiante_ajeno), format='json')

    assert respuesta.status_code == 403
    assert respuesta.json() == {'detail': 'No podés enviar mensajes a este destinatario en esta materia.'}
    assert repositorio.contar_recibidos(estudiante_ajeno.pk) == 0


@pytest.mark.parametrize('quien', ['admin', 'profesor_ajeno', 'estudiante_ajeno', None])
def test_leer_matriz_solo_el_destinatario(
    api_as, cliente_anonimo, request, materia_con_inscripcion, profesor, estudiante, quien
):
    id_ = _guardar(materia_con_inscripcion, profesor, estudiante)
    cliente = api_as(request.getfixturevalue(quien)) if quien else cliente_anonimo

    respuesta = cliente.post(f'{MENSAJES}{id_}/leer/')

    assert respuesta.status_code == (401 if quien is None else 404)


def test_el_destinatario_marca_leido_y_es_idempotente(api_as, materia_con_inscripcion, profesor, estudiante):
    id_ = _guardar(materia_con_inscripcion, profesor, estudiante)
    cliente = api_as(estudiante)

    for _ in range(2):
        respuesta = cliente.post(f'{MENSAJES}{id_}/leer/')
        assert respuesta.status_code == 200
        assert respuesta.json() == {'id': id_, 'leido': True}


def test_el_remitente_no_puede_marcar_leido_su_mensaje(api_as, materia_con_inscripcion, profesor, estudiante):
    id_ = _guardar(materia_con_inscripcion, profesor, estudiante)

    assert api_as(profesor).post(f'{MENSAJES}{id_}/leer/').status_code == 404


def test_leer_con_id_invalido_o_inexistente_es_404(api_as, estudiante):
    cliente = api_as(estudiante)

    assert cliente.post(f'{MENSAJES}no-es-un-id/leer/').status_code == 404
    assert cliente.post(f'{MENSAJES}66520a000000000000000000/leer/').status_code == 404


# --- Listado ---

def test_listado_admin_es_403_y_anonimo_401(api_as, cliente_anonimo, admin):
    assert api_as(admin).get(MENSAJES).status_code == 403
    assert cliente_anonimo.get(MENSAJES).status_code == 401


def test_listado_muestra_solo_propios_con_formato_del_contrato(
    api_as, materia_con_inscripcion, profesor, estudiante, estudiante_ajeno
):
    _guardar(materia_con_inscripcion, profesor, estudiante)
    _guardar(materia_con_inscripcion, profesor, estudiante_ajeno)

    datos = api_as(estudiante).get(MENSAJES).json()

    assert datos['count'] == 1 and datos['no_leidos'] == 1
    assert datos['next'] is None and datos['previous'] is None
    mensaje = datos['results'][0]
    assert set(mensaje) == {
        'id', 'materia', 'remitente', 'destinatario', 'asunto', 'cuerpo', 'fecha_creacion', 'leido',
    }
    assert mensaje['materia'] == {'id': materia_con_inscripcion.pk, 'nombre': materia_con_inscripcion.titulo}
    assert mensaje['remitente']['id'] == profesor.pk
    assert mensaje['destinatario']['id'] == estudiante.pk
    assert mensaje['fecha_creacion'].endswith('Z')
    assert set(mensaje['remitente']) == {'id', 'nombre_completo'}


def test_listado_bandeja_enviados_y_filtros(api_as, materia_con_inscripcion, profesor, estudiante):
    _guardar(materia_con_inscripcion, profesor, estudiante)
    leido = _guardar(materia_con_inscripcion, profesor, estudiante, leido=True)
    _guardar(materia_con_inscripcion, estudiante, profesor)

    enviados = api_as(profesor).get(MENSAJES, {'bandeja': 'enviados'}).json()
    recibidos = api_as(profesor).get(MENSAJES).json()
    sin_leer = api_as(estudiante).get(MENSAJES, {'no_leidos': 'true'}).json()
    otra_materia = api_as(estudiante).get(MENSAJES, {'materia': 999}).json()

    assert enviados['count'] == 2 and recibidos['count'] == 1
    assert sin_leer['count'] == 1 and leido not in [m['id'] for m in sin_leer['results']]
    assert otra_materia['count'] == 0


def test_listado_pagina_con_enlaces_y_tope_de_page_size(api_as, materia_con_inscripcion, profesor, estudiante):
    for minuto in range(3):
        _guardar(materia_con_inscripcion, profesor, estudiante, minutos=minuto)
    cliente = api_as(estudiante)

    primera = cliente.get(MENSAJES, {'page': 1, 'page_size': 2}).json()
    segunda = cliente.get(MENSAJES, {'page': 2, 'page_size': 2}).json()
    tope = cliente.get(MENSAJES, {'page_size': 500}).json()

    assert len(primera['results']) == 2 and primera['next'] and primera['previous'] is None
    assert len(segunda['results']) == 1 and segunda['next'] is None and segunda['previous']
    assert tope['count'] == 3


@pytest.mark.parametrize('params', [{'bandeja': 'otra'}, {'materia': 'x'}, {'page': 'x'}])
def test_listado_con_parametros_invalidos_es_400(api_as, estudiante, params):
    assert api_as(estudiante).get(MENSAJES, params).status_code == 400


# --- Envío: validación, errores y efectos ---

@pytest.mark.parametrize('campo,valor', [
    ('asunto', ''), ('asunto', 'a' * 121), ('cuerpo', ''), ('cuerpo', 'a' * 2001), ('cuerpo', '   '),
])
def test_enviar_valida_largos_por_campo(api_as, materia_con_inscripcion, profesor, estudiante, campo, valor):
    respuesta = api_as(profesor).post(MENSAJES, cuerpo(materia_con_inscripcion, estudiante, **{campo: valor}), format='json')

    assert respuesta.status_code == 400
    assert isinstance(respuesta.json()[campo], list)


def test_enviar_devuelve_el_formato_de_lista_y_guarda(api_as, materia_con_inscripcion, profesor, estudiante):
    respuesta = api_as(profesor).post(MENSAJES, cuerpo(materia_con_inscripcion, estudiante), format='json')

    creado = respuesta.json()
    assert respuesta.status_code == 201
    assert creado['leido'] is False and creado['destinatario']['id'] == estudiante.pk
    assert repositorio.contar_no_leidos(estudiante.pk) == 1


def test_enviar_a_materia_inexistente_es_404(api_as, profesor, estudiante):
    respuesta = api_as(profesor).post(
        MENSAJES, {'materia_id': 999999, 'destinatario_id': estudiante.pk, 'asunto': 'A', 'cuerpo': 'B'}, format='json'
    )

    assert respuesta.status_code == 404


def test_mongo_caido_al_enviar_o_listar_es_503(api_as, materia_con_inscripcion, profesor, estudiante):
    with mock.patch('mensajeria.repositorio.crear', side_effect=PyMongoError('boom')):
        enviar = api_as(profesor).post(MENSAJES, cuerpo(materia_con_inscripcion, estudiante), format='json')
    with mock.patch('mensajeria.repositorio.listar_recibidos', side_effect=PyMongoError('boom')):
        listar = api_as(profesor).get(MENSAJES)

    assert enviar.status_code == 503 and listar.status_code == 503
    assert 'detail' in enviar.json()


def test_enviar_publica_mensaje_nuevo_solo_al_destinatario(api_as, materia_con_inscripcion, profesor, estudiante):
    capa = get_channel_layer()
    async_to_sync(capa.group_add)(f'usuario_{estudiante.pk}', 'canal-destino')
    async_to_sync(capa.group_add)(f'usuario_{profesor.pk}', 'canal-remitente')

    creado = api_as(profesor).post(MENSAJES, cuerpo(materia_con_inscripcion, estudiante), format='json').json()

    evento = async_to_sync(capa.receive)('canal-destino')
    assert evento['tipo'] == 'mensaje.nuevo'
    assert evento['datos'] == creado
    with pytest.raises(asyncio.TimeoutError):  # el canal del remitente no recibe nada
        async_to_sync(_recibir_con_timeout)(capa, 'canal-remitente')


async def _recibir_con_timeout(capa, canal):
    return await asyncio.wait_for(capa.receive(canal), timeout=0.2)


def test_leer_publica_mensaje_leido_al_remitente(api_as, materia_con_inscripcion, profesor, estudiante):
    id_ = _guardar(materia_con_inscripcion, profesor, estudiante)
    capa = get_channel_layer()
    async_to_sync(capa.group_add)(f'usuario_{profesor.pk}', 'canal-remitente')

    api_as(estudiante).post(f'{MENSAJES}{id_}/leer/')

    evento = async_to_sync(capa.receive)('canal-remitente')
    assert evento['tipo'] == 'mensaje.leido'
    assert evento['datos'] == {'id': id_, 'leido': True}


def test_un_fallo_del_tiempo_real_no_rompe_la_respuesta(api_as, materia_con_inscripcion, profesor, estudiante):
    with mock.patch('mensajeria.views.publicar', side_effect=RuntimeError('redis caído')):
        enviar = api_as(profesor).post(MENSAJES, cuerpo(materia_con_inscripcion, estudiante), format='json')
        leer = api_as(estudiante).post(f'{MENSAJES}{enviar.json()["id"]}/leer/')

    assert enviar.status_code == 201 and leer.status_code == 200
    assert repositorio.contar_no_leidos(estudiante.pk) == 0


def test_el_cuerpo_del_mensaje_nunca_se_registra_en_el_log(
    api_as, materia_con_inscripcion, profesor, estudiante, caplog
):
    secreto = 'contenido-privado-xyz'
    with caplog.at_level(logging.DEBUG):
        with mock.patch('mensajeria.views.publicar', side_effect=RuntimeError('falla')):
            api_as(profesor).post(MENSAJES, cuerpo(materia_con_inscripcion, estudiante, cuerpo=secreto), format='json')
        with mock.patch('mensajeria.repositorio.crear', side_effect=PyMongoError('boom')):
            api_as(profesor).post(MENSAJES, cuerpo(materia_con_inscripcion, estudiante, cuerpo=secreto), format='json')

    assert secreto not in caplog.text


# --- Borrado ---

def test_el_remitente_borra_dentro_de_15_minutos_y_desaparece_para_ambos(
    api_as, materia_con_inscripcion, profesor, estudiante
):
    id_ = _guardar(materia_con_inscripcion, profesor, estudiante)

    respuesta = api_as(profesor).delete(f'{MENSAJES}{id_}/')

    assert respuesta.status_code == 204
    assert api_as(estudiante).get(MENSAJES).json()['count'] == 0
    assert api_as(profesor).get(MENSAJES, {'bandeja': 'enviados'}).json()['count'] == 0


def test_borrar_fuera_de_plazo_es_400_y_no_borra(api_as, materia_con_inscripcion, profesor, estudiante):
    id_ = _guardar(materia_con_inscripcion, profesor, estudiante, minutos=-16)

    respuesta = api_as(profesor).delete(f'{MENSAJES}{id_}/')

    assert respuesta.status_code == 400
    assert respuesta.json() == {'detail': 'El mensaje ya no puede eliminarse.'}
    assert repositorio.contar_recibidos(estudiante.pk) == 1


@pytest.mark.parametrize('quien', ['estudiante', 'admin', 'profesor_ajeno'])
def test_borrar_ajeno_es_404(api_as, request, materia_con_inscripcion, profesor, estudiante, quien):
    id_ = _guardar(materia_con_inscripcion, profesor, estudiante)

    assert api_as(request.getfixturevalue(quien)).delete(f'{MENSAJES}{id_}/').status_code == 404
    assert repositorio.contar_recibidos(estudiante.pk) == 1


def test_borrar_anonimo_es_401_e_id_invalido_es_404(api_as, cliente_anonimo, profesor):
    assert cliente_anonimo.delete(f'{MENSAJES}66520a000000000000000000/').status_code == 401
    assert api_as(profesor).delete(f'{MENSAJES}no-es-un-id/').status_code == 404


def test_demasiados_envios_responde_429_en_espanol(
    api_as, materia_con_inscripcion, profesor, estudiante, settings
):
    from django.core.cache import cache
    from rest_framework.throttling import UserRateThrottle

    cache.clear()
    tasas = {**settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'], 'mensajes': '2/min'}
    with mock.patch.object(UserRateThrottle, 'THROTTLE_RATES', tasas):
        cliente = api_as(profesor)
        codigos = [
            cliente.post(MENSAJES, cuerpo(materia_con_inscripcion, estudiante), format='json')
            for _ in range(3)
        ]

    assert [r.status_code for r in codigos] == [201, 201, 429]
    assert codigos[2].json()['detail'].startswith('Enviaste demasiados mensajes. Intentá de nuevo en un momento.')
    cache.clear()


def test_el_listado_no_tiene_limite_de_envios(api_as, estudiante):
    cliente = api_as(estudiante)

    assert all(cliente.get(MENSAJES).status_code == 200 for _ in range(5))


def test_estudiante_dado_de_baja_lee_su_historial_pero_no_envia(
    api_as, materia_con_inscripcion, profesor, estudiante
):
    id_ = _guardar(materia_con_inscripcion, profesor, estudiante)
    materia_con_inscripcion.inscripciones.update(estado='BAJA')
    cliente = api_as(estudiante)

    assert cliente.get(MENSAJES).json()['count'] == 1
    assert cliente.post(f'{MENSAJES}{id_}/leer/').status_code == 200
    assert cliente.post(MENSAJES, cuerpo(materia_con_inscripcion, profesor), format='json').status_code == 403
    assert cliente.get(destinatarios_url(materia_con_inscripcion)).status_code == 403
    assert api_as(profesor).get(destinatarios_url(materia_con_inscripcion)).json() == []
