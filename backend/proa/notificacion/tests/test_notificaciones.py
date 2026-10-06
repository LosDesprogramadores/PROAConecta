from datetime import datetime

import pytest
from bson.objectid import ObjectId

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from notificacion import mongo
from usuario.tests.factories import UsuarioFactory

URL = '/api/notificaciones/'


@pytest.fixture(autouse=True)
def coleccion_vacia():
    mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION).delete_many({})
    yield
    mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION).delete_many({})


def _coleccion():
    return mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION)


def _aviso(titulo, **campos):
    doc = {'titulo': titulo, 'mensaje': 'm', 'alcance': 'AMBOS', 'materia_id': None,
           'fecha_creacion': datetime(2026, 1, 1), 'leida_por': []}
    doc.update(campos)
    return str(_coleccion().insert_one(doc).inserted_id)


def _titulos(respuesta):
    return {n['titulo'] for n in respuesta.json()}


@pytest.fixture
def escenario(materia_con_inscripcion, profesor, estudiante, rol_profesor, rol_estudiante):
    materia = materia_con_inscripcion
    ajena = MateriaFactory()
    otro_profesor = UsuarioFactory(persona__rol=rol_profesor)
    otro_estudiante = UsuarioFactory(persona__rol=rol_estudiante)
    _aviso('general', alcance='AMBOS')
    _aviso('todos', alcance='TODOS')
    _aviso('solo-estudiantes', alcance='ESTUDIANTE')
    _aviso('solo-profesores', alcance='PROFESOR')
    _aviso('de-mi-materia', alcance='ESTUDIANTE', materia_id=materia.id)
    _aviso('materia-ajena', alcance='AMBOS', materia_id=ajena.id)
    _aviso('para-estudiante', alcance='PROFESOR', usuario_destino_id=estudiante.pk)
    _aviso('para-otro', alcance='PROFESOR', usuario_destino_id=otro_estudiante.pk)
    return materia, ajena, otro_profesor, otro_estudiante


def test_estudiante_ve_su_alcance_sus_materias_y_lo_dirigido_a_el(api_as, estudiante, escenario):
    respuesta = api_as(estudiante).get(URL)
    assert respuesta.status_code == 200
    assert _titulos(respuesta) == {'general', 'todos', 'solo-estudiantes', 'de-mi-materia', 'para-estudiante'}


def test_profesor_ve_su_alcance_y_las_materias_que_dicta(api_as, profesor, escenario):
    assert _titulos(api_as(profesor).get(URL)) == {
        'general', 'todos', 'solo-profesores', 'de-mi-materia', 'para-estudiante', 'para-otro',
    }  # los dos últimos entran por alcance PROFESOR, no por destinatario


def test_profesor_ajeno_no_ve_materias_que_no_dicta(api_as, escenario):
    _, _, otro_profesor, _ = escenario
    titulos = _titulos(api_as(otro_profesor).get(URL))
    assert 'de-mi-materia' not in titulos
    assert 'materia-ajena' not in titulos


def test_administrador_ve_todo(api_as, admin, escenario):
    assert len(api_as(admin).get(URL).json()) == 8


def test_estudiante_dado_de_baja_pierde_los_avisos_de_la_materia(api_as, estudiante, escenario):
    materia = escenario[0]
    Inscripcion.objects.filter(materia=materia).update(estado=Inscripcion.EstadoInscripcion.BAJA)
    assert 'de-mi-materia' not in _titulos(api_as(estudiante).get(URL))


def test_estudiante_libre_conserva_los_avisos_de_la_materia(api_as, estudiante, escenario):
    materia = escenario[0]
    Inscripcion.objects.filter(materia=materia).update(estado=Inscripcion.EstadoInscripcion.LIBRE)
    assert 'de-mi-materia' in _titulos(api_as(estudiante).get(URL))


def test_estudiante_sin_inscripcion_no_ve_avisos_de_materias(api_as, rol_estudiante, escenario):
    sin_materias = UsuarioFactory(persona__rol=rol_estudiante)
    titulos = _titulos(api_as(sin_materias).get(URL))
    assert titulos == {'general', 'todos', 'solo-estudiantes'}


def test_anonimo_recibe_401(cliente_anonimo):
    assert cliente_anonimo.get(URL).status_code == 401


def test_paginacion_con_page_size(api_as, admin, escenario):
    cuerpo = api_as(admin).get(URL, {'page': 1, 'page_size': 3}).json()
    assert cuerpo['count'] == 8
    assert len(cuerpo['results']) == 3
    assert cuerpo['next'] is not None and cuerpo['previous'] is None
    assert 'no_leidas' in cuerpo


def test_page_size_tiene_tope(api_as, admin, escenario):
    cuerpo = api_as(admin).get(URL, {'page': 1, 'page_size': 999}).json()
    assert len(cuerpo['results']) == 8  # tope 50, hay 8


def test_limit_acota_el_listado_sin_paginar(api_as, admin, escenario):
    assert len(api_as(admin).get(URL, {'limit': 2}).json()) == 2


def test_filtro_materia_id(api_as, admin, escenario):
    respuesta = api_as(admin).get(URL, {'materia_id': escenario[0].id})
    assert _titulos(respuesta) == {'de-mi-materia'}


def test_materia_id_no_numerico_da_400(api_as, admin):
    assert api_as(admin).get(URL, {'materia_id': 'abc'}).status_code == 400


def test_leer_marca_solo_para_el_usuario(api_as, estudiante, profesor, escenario):
    id_ = _aviso('leible', alcance='AMBOS')
    respuesta = api_as(estudiante).post(f'{URL}{id_}/leer/')
    assert respuesta.status_code == 200
    assert respuesta.json() == {'id': id_, 'leida': True}
    # idempotente
    assert api_as(estudiante).post(f'{URL}{id_}/leer/').status_code == 200
    assert _coleccion().find_one({'_id': ObjectId(id_)})['leida_por'] == [estudiante.pk]

    por_titulo = {n['titulo']: n for n in api_as(estudiante).get(URL).json()}
    assert por_titulo['leible']['leida'] is True
    assert {n['titulo']: n for n in api_as(profesor).get(URL).json()}['leible']['leida'] is False


def test_leer_aviso_no_visible_da_404(api_as, estudiante, escenario):
    id_ = _aviso('oculto', alcance='PROFESOR')
    assert api_as(estudiante).post(f'{URL}{id_}/leer/').status_code == 404


def test_leer_id_invalido_da_400(api_as, estudiante):
    respuesta = api_as(estudiante).post(f'{URL}no-es-un-id/leer/')
    assert respuesta.status_code == 400
    assert 'detail' in respuesta.json()


def test_leer_anonimo_recibe_401(cliente_anonimo):
    assert cliente_anonimo.post(f'{URL}{ObjectId()}/leer/').status_code == 401


def test_usuario_origen_sale_de_la_sesion(api_as, admin):
    respuesta = api_as(admin).post(
        URL, {'titulo': 'T', 'mensaje': 'M', 'usuario_origen_id': 999}, format='json')
    assert respuesta.status_code == 201
    doc = _coleccion().find_one({'_id': ObjectId(respuesta.json()['id'])})
    assert doc['usuario_origen_id'] == admin.pk
    assert doc['leida_por'] == []


@pytest.mark.parametrize('cuerpo, campo', [
    ({'mensaje': 'M'}, 'titulo'),
    ({'titulo': 'T'}, 'mensaje'),
    ({'titulo': 'T' * 121, 'mensaje': 'M'}, 'titulo'),
    ({'titulo': 'T', 'mensaje': 'M' * 2001}, 'mensaje'),
    ({'titulo': 'T', 'mensaje': 'M', 'alcance': 'NADIE'}, 'alcance'),
    ({'titulo': 'T', 'mensaje': 'M', 'materia_id': 'abc'}, 'materia_id'),
])
def test_payload_invalido_da_400_por_campo(api_as, admin, cuerpo, campo):
    respuesta = api_as(admin).post(URL, cuerpo, format='json')
    assert respuesta.status_code == 400
    assert campo in respuesta.json()
    assert _coleccion().count_documents({}) == 0


def test_put_con_id_invalido_da_400_sin_detalle_interno(api_as, admin):
    respuesta = api_as(admin).put(f'{URL}xyz/', {'titulo': 'a'}, format='json')
    assert respuesta.status_code == 400
    assert respuesta.json() == {'detail': 'Identificador de notificación inválido.'}


def test_put_inexistente_da_404_con_detail(api_as, admin):
    respuesta = api_as(admin).put(f'{URL}{ObjectId()}/', {'titulo': 'a'}, format='json')
    assert respuesta.status_code == 404
    assert 'detail' in respuesta.json()


def test_put_actualiza_solo_los_campos_enviados(api_as, admin):
    id_ = _aviso('viejo', mensaje='conservado')
    assert api_as(admin).put(f'{URL}{id_}/', {'titulo': 'nuevo'}, format='json').status_code == 200
    doc = _coleccion().find_one({'_id': ObjectId(id_)})
    assert doc['titulo'] == 'nuevo' and doc['mensaje'] == 'conservado'


def test_mongo_caido_da_503_en_listado_y_lectura(api_as, estudiante, monkeypatch):
    from pymongo.errors import ServerSelectionTimeoutError

    def caido(*args, **kwargs):
        raise ServerSelectionTimeoutError('boom interno')

    monkeypatch.setattr('notificacion.services.obtener_coleccion', caido)
    respuesta = api_as(estudiante).get(URL)
    assert respuesta.status_code == 503
    assert 'boom' not in respuesta.content.decode()
    assert api_as(estudiante).post(f'{URL}{ObjectId()}/leer/').status_code == 503


def test_error_inesperado_no_filtra_str_e(api_as, admin, monkeypatch):
    from pymongo.errors import PyMongoError

    def falla(*args, **kwargs):
        raise PyMongoError('secreto-de-conexion')

    monkeypatch.setattr('notificacion.services.obtener_coleccion', falla)
    respuesta = api_as(admin).post(URL, {'titulo': 'T', 'mensaje': 'M'}, format='json')
    assert respuesta.status_code == 503
    assert 'secreto' not in respuesta.content.decode()
