"""Bitácora de cambios de estado en MongoDB (C15, #219)."""
import logging
from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest
from django.db import transaction
from pymongo.errors import PyMongoError

from auditoria import bitacora
from notificacion import mongo

pytestmark = pytest.mark.django_db

URL = '/api/auditoria/eventos/'


@pytest.fixture(autouse=True)
def coleccion_vacia():
    coleccion = mongo.obtener_coleccion(mongo.COLECCION_BITACORA)
    coleccion.delete_many({})
    yield
    coleccion.delete_many({})


def _coleccion():
    return mongo.obtener_coleccion(mongo.COLECCION_BITACORA)


def _insertar(tipo='NOTA_CREADA', entidad='nota', actor_id=1, dias=0, **extra):
    _coleccion().insert_one({
        'fecha': datetime(2026, 10, 1, tzinfo=timezone.utc) + timedelta(days=dias),
        'tipo': tipo, 'actor_id': actor_id, 'actor_rol': 'PROFESOR', 'entidad': entidad,
        'entidad_id': 88, 'materia_id': 7, 'datos': {}, **extra,
    })


# --- Escritura ---

def test_registrar_evento_guarda_despues_del_commit(admin, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        bitacora.registrar_evento(
            'NOTA_MODIFICADA', admin, 'nota',
            {'antes': {'calificacion': '6.00'}, 'despues': {'calificacion': '7.50'}},
            entidad_id=88, materia_id=7,
        )

    assert _coleccion().count_documents({}) == 0  # todavía no se confirmó
    for callback in callbacks:
        callback()

    evento = _coleccion().find_one({})
    assert evento['tipo'] == 'NOTA_MODIFICADA'
    assert evento['actor_id'] == admin.pk and evento['actor_rol'] == 'ADMINISTRADOR'
    assert evento['entidad'] == 'nota' and evento['entidad_id'] == 88 and evento['materia_id'] == 7
    assert evento['datos'] == {'antes': {'calificacion': '6.00'}, 'despues': {'calificacion': '7.50'}}
    assert evento['fecha'] is not None


def test_no_registra_nada_si_la_transaccion_se_revierte(admin, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        with pytest.raises(RuntimeError):
            with transaction.atomic():
                bitacora.registrar_evento('INSCRIPCION_CREADA', admin, 'inscripcion', {'despues': {'estado': 'CURSANDO'}})
                raise RuntimeError('rollback')

    assert _coleccion().count_documents({}) == 0


def test_un_fallo_de_mongo_se_registra_y_no_rompe_la_operacion(admin, caplog, django_capture_on_commit_callbacks):
    with caplog.at_level(logging.WARNING):
        with mock.patch('auditoria.bitacora.obtener_coleccion', side_effect=PyMongoError('mongo caído')):
            with django_capture_on_commit_callbacks(execute=True):
                bitacora.registrar_evento('PERSONA_BAJA', admin, 'persona', {'antes': {'activo': True}})

    assert 'PERSONA_BAJA' in caplog.text
    assert _coleccion().count_documents({}) == 0


def test_nunca_guarda_secretos_ni_cuerpos_de_mensaje(admin, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        bitacora.registrar_evento('MENSAJE_ENVIADO', admin, 'mensaje', {
            'despues': {'asunto': 'Hola', 'cuerpo': 'privado', 'password': 'x', 'access_token': 'y',
                        'anidado': {'Clave': 'z', 'ok': 1}},
            'ticket': 'abc',
        })

    assert _coleccion().find_one({})['datos'] == {'despues': {'asunto': 'Hola', 'anidado': {'ok': 1}}}


def test_actor_ausente_se_registra_como_sistema(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        bitacora.registrar_evento('LOGIN_FALLIDO', None, 'usuario')

    evento = _coleccion().find_one({})
    assert evento['actor_id'] is None and evento['actor_rol'] is None and evento['datos'] == {}


# --- Lectura ---

@pytest.mark.parametrize('quien,esperado', [
    ('admin', 200), ('profesor', 403), ('estudiante', 403), (None, 401),
])
def test_solo_el_administrador_lee_la_bitacora(api_as, cliente_anonimo, request, quien, esperado):
    cliente = api_as(request.getfixturevalue(quien)) if quien else cliente_anonimo

    assert cliente.get(URL).status_code == esperado


def test_listado_tiene_el_formato_del_contrato_sin_ip(api_as, admin, profesor):
    _insertar(actor_id=profesor.pk, ip='10.0.0.5', datos={'antes': {'calificacion': '6.00'}})

    datos = api_as(admin).get(URL).json()

    assert datos['count'] == 1 and datos['next'] is None and datos['previous'] is None
    evento = datos['results'][0]
    assert set(evento) == {'id', 'fecha', 'actor', 'tipo', 'entidad', 'entidad_id', 'materia_id', 'datos'}
    assert evento['actor'] == {
        'id': profesor.pk, 'nombre_completo': f'{profesor.persona.apellido}, {profesor.persona.nombre}',
        'rol': 'PROFESOR',
    }
    assert evento['fecha'].endswith('Z')


def test_listado_ordena_por_fecha_descendente(api_as, admin):
    _insertar(tipo='A', dias=0)
    _insertar(tipo='C', dias=2)
    _insertar(tipo='B', dias=1)

    tipos = [e['tipo'] for e in api_as(admin).get(URL).json()['results']]

    assert tipos == ['C', 'B', 'A']


def test_filtros_por_tipo_entidad_actor_y_materia(api_as, admin):
    _insertar(tipo='NOTA_CREADA', entidad='nota', actor_id=1)
    _insertar(tipo='PERSONA_BAJA', entidad='persona', actor_id=2, materia_id=None)
    cliente = api_as(admin)

    assert cliente.get(URL, {'tipo': 'PERSONA_BAJA'}).json()['count'] == 1
    assert cliente.get(URL, {'entidad': 'nota'}).json()['count'] == 1
    assert cliente.get(URL, {'entidad': 'nota', 'entidad_id': 88}).json()['count'] == 1
    assert cliente.get(URL, {'entidad_id': 5}).json()['count'] == 0
    assert cliente.get(URL, {'actor_id': 2}).json()['count'] == 1
    assert cliente.get(URL, {'materia_id': 7}).json()['count'] == 1


def test_filtro_por_rango_de_fechas(api_as, admin):
    for dias in (0, 5, 10):
        _insertar(dias=dias)
    cliente = api_as(admin)

    solo_medio = cliente.get(URL, {'desde': '2026-10-03T00:00:00Z', 'hasta': '2026-10-08T00:00:00Z'}).json()
    desde = cliente.get(URL, {'desde': '2026-10-06T00:00:00+00:00'}).json()

    assert solo_medio['count'] == 1
    assert desde['count'] == 2  # el límite inferior es inclusivo


@pytest.mark.parametrize('params', [
    {'desde': 'ayer'}, {'hasta': '2026-13-45'}, {'entidad_id': 'x'}, {'page': 'x'}, {'page_size': '-'},
])
def test_parametros_invalidos_son_400(api_as, admin, params):
    respuesta = api_as(admin).get(URL, params)

    assert respuesta.status_code == 400
    assert isinstance(next(iter(respuesta.json().values())), list)


def test_paginacion_con_enlaces_y_tope_de_100(api_as, admin):
    for dias in range(3):
        _insertar(dias=dias)
    cliente = api_as(admin)

    primera = cliente.get(URL, {'page_size': 2}).json()
    segunda = cliente.get(URL, {'page': 2, 'page_size': 2}).json()
    tope = cliente.get(URL, {'page_size': 5000}).json()

    assert len(primera['results']) == 2 and primera['next'] and primera['previous'] is None
    assert len(segunda['results']) == 1 and segunda['next'] is None and segunda['previous']
    assert tope['count'] == 3


def test_mongo_caido_al_leer_es_503(api_as, admin):
    with mock.patch('auditoria.bitacora.obtener_coleccion', side_effect=PyMongoError('boom')):
        respuesta = api_as(admin).get(URL)

    assert respuesta.status_code == 503
    assert 'detail' in respuesta.json()


def test_crear_indices_mongo_incluye_los_de_bitacora():
    from django.core.management import call_command

    call_command('crear_indices_mongo')

    claves = [i['key'] for i in _coleccion().index_information().values()]
    assert [('fecha', -1)] in claves
    assert [('entidad', 1), ('entidad_id', 1), ('fecha', -1)] in claves
    assert [('actor_id', 1), ('fecha', -1)] in claves
    assert [('materia_id', 1), ('fecha', -1)] in claves
    assert [('entidad_id', 1), ('fecha', -1)] in claves
