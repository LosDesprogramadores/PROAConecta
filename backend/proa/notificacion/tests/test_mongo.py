import importlib
from datetime import datetime

import mongomock
import pymongo
import pytest
from bson.objectid import ObjectId
from django.core.management import call_command
from pymongo.errors import PyMongoError

from notificacion import mongo


@pytest.fixture(autouse=True)
def cliente_limpio(monkeypatch):
    # Cada test arranca sin cliente cacheado y cuenta cuántos clientes se crean
    monkeypatch.setattr(mongo, '_cliente', None)
    monkeypatch.setattr(mongo, '_db', None)
    creados = []

    def fabrica(*args, **kwargs):
        cliente = mongomock.MongoClient()
        creados.append((args, kwargs))
        return cliente

    monkeypatch.setattr(pymongo, 'MongoClient', fabrica)
    return creados


def test_importar_el_modulo_no_crea_cliente(monkeypatch):
    # Se recarga el módulo con MongoClient que falla: si se conectara al importar, explota
    def no_debe_llamarse(*args, **kwargs):
        raise AssertionError('se creó un MongoClient al importar')

    monkeypatch.setattr(pymongo, 'MongoClient', no_debe_llamarse)
    importlib.reload(mongo)
    assert mongo._cliente is None
    assert mongo._db is None


def test_obtener_db_crea_el_cliente_al_primer_uso(cliente_limpio, settings):
    settings.MONGO_DB_NAME = 'proa_test'
    db = mongo.obtener_db()
    assert db.name == 'proa_test'
    assert len(cliente_limpio) == 1
    assert cliente_limpio[0][1]['serverSelectionTimeoutMS'] == 5000


def test_obtener_db_devuelve_siempre_la_misma_instancia(cliente_limpio):
    assert mongo.obtener_db() is mongo.obtener_db()
    assert len(cliente_limpio) == 1


def test_obtener_coleccion_usa_la_base_unica():
    coleccion = mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION)
    coleccion.insert_one({'titulo': 'Aviso'})
    assert mongo.obtener_db()['notificacion'].count_documents({}) == 1


def test_nombres_de_coleccion():
    assert mongo.COLECCION_NOTIFICACION == 'notificacion'
    assert mongo.COLECCION_MENSAJE == 'mensaje'
    assert mongo.COLECCION_BITACORA == 'bitacora'


def _claves_de_indices():
    info = mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION).index_information()
    return {tuple(valor['key']) for nombre, valor in info.items() if nombre != '_id_'}


def test_crear_indices_mongo_crea_los_indices_esperados():
    call_command('crear_indices_mongo')
    assert _claves_de_indices() == {
        (('fecha_creacion', -1),),
        (('materia_id', 1), ('fecha_creacion', -1)),
        (('alcance', 1), ('fecha_creacion', -1)),
        (('usuario_destino_id', 1), ('fecha_creacion', -1)),
    }


def test_crear_indices_mongo_es_idempotente():
    call_command('crear_indices_mongo')
    primeros = _claves_de_indices()
    call_command('crear_indices_mongo')
    assert _claves_de_indices() == primeros


URL = '/api/notificaciones/'


@pytest.fixture
def cliente(api_as, estudiante):
    return api_as(estudiante)


def test_listado_devuelve_200_ordenado_por_fecha_desc(cliente):
    coleccion = mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION)
    coleccion.insert_one({'titulo': 'vieja', 'fecha_creacion': datetime(2026, 1, 1)})
    coleccion.insert_one({'titulo': 'nueva', 'fecha_creacion': datetime(2026, 6, 1)})
    respuesta = cliente.get(URL)
    assert respuesta.status_code == 200
    assert [n['titulo'] for n in respuesta.json()] == ['nueva', 'vieja']


def test_detalle_con_id_inexistente_devuelve_404(cliente):
    respuesta = cliente.delete(f'{URL}{ObjectId()}/')
    assert respuesta.status_code == 404
    respuesta = cliente.put(f'{URL}{ObjectId()}/', {'titulo': 'x'}, format='json')
    assert respuesta.status_code == 404


def test_detalle_con_object_id_invalido_devuelve_400(cliente):
    assert cliente.delete(f'{URL}no-es-un-id/').status_code == 400
    assert cliente.put(f'{URL}no-es-un-id/', {}, format='json').status_code == 400


def test_listado_con_mongo_caido_devuelve_503(cliente, monkeypatch):
    def falla(nombre):
        raise PyMongoError('sin conexión')

    monkeypatch.setattr(mongo, 'obtener_coleccion', falla)
    monkeypatch.setattr('notificacion.views.obtener_coleccion', falla)
    respuesta = cliente.get(URL)
    assert respuesta.status_code == 503
    assert respuesta.json() == {'detail': 'Servicio de notificaciones no disponible'}
