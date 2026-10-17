"""Anuncios del profesor a los inscriptos de la materia (C1, TSK146)."""
from datetime import datetime, timezone
from unittest import mock

import pytest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from pymongo.errors import PyMongoError

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from notificacion import mongo
from usuario.tests.factories import UsuarioFactory

pytestmark = pytest.mark.django_db

CUERPO = {'titulo': 'Cambio de fecha del parcial', 'mensaje': 'El parcial pasa al jueves 15.'}


def url(materia):
    return f'/api/materias/{materia.pk}/anuncios/'


def _coleccion():
    return mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION)


@pytest.fixture(autouse=True)
def coleccion_vacia():
    _coleccion().delete_many({})
    yield
    _coleccion().delete_many({})


@pytest.fixture
def profesor_ajeno(rol_profesor):
    return UsuarioFactory(persona__rol=rol_profesor)


@pytest.fixture
def estudiante_no_inscripto(rol_estudiante):
    return UsuarioFactory(persona__rol=rol_estudiante)


def _anuncio(materia, titulo='Aviso', **campos):
    doc = {
        'titulo': titulo, 'mensaje': 'm', 'tipo_notificacion_codigo': 'ANUNCIO', 'alcance': 'ESTUDIANTES',
        'materia_id': materia.pk, 'usuario_origen_id': 1, 'leida_por': [],
        'fecha_creacion': datetime(2026, 1, 1, tzinfo=timezone.utc),
    }
    doc.update(campos)
    _coleccion().insert_one(doc)


# --- matriz de roles: POST ---

def test_profesor_titular_publica_un_anuncio(api_as, profesor, materia_con_inscripcion):
    respuesta = api_as(profesor).post(url(materia_con_inscripcion), CUERPO, format='json')

    assert respuesta.status_code == 201


@pytest.mark.parametrize('quien,estado', [
    ('admin', 403),  # los avisos institucionales van por POST /api/notificaciones/
    ('profesor_ajeno', 403),
    ('estudiante', 403),
    ('estudiante_no_inscripto', 403),
])
def test_los_demas_roles_no_publican_anuncios(quien, estado, request, api_as, materia_con_inscripcion):
    respuesta = api_as(request.getfixturevalue(quien)).post(url(materia_con_inscripcion), CUERPO, format='json')

    assert respuesta.status_code == estado
    assert _coleccion().count_documents({}) == 0


def test_anonimo_no_publica(cliente_anonimo, materia_con_inscripcion):
    assert cliente_anonimo.post(url(materia_con_inscripcion), CUERPO, format='json').status_code == 401


def test_publicar_en_una_materia_inexistente_o_dada_de_baja_es_404(api_as, profesor, materia_con_inscripcion):
    cliente = api_as(profesor)
    assert cliente.post('/api/materias/999999/anuncios/', CUERPO, format='json').status_code == 404

    materia_con_inscripcion.soft_delete()
    assert cliente.post(url(materia_con_inscripcion), CUERPO, format='json').status_code == 404


# --- matriz de roles: GET ---

@pytest.mark.parametrize('quien,estado', [
    ('admin', 200),
    ('profesor', 200),
    ('profesor_ajeno', 403),
    ('estudiante', 200),
    ('estudiante_no_inscripto', 404),
])
def test_matriz_de_lectura_de_anuncios(quien, estado, request, api_as, materia_con_inscripcion):
    respuesta = api_as(request.getfixturevalue(quien)).get(url(materia_con_inscripcion))

    assert respuesta.status_code == estado


def test_anonimo_no_lee_anuncios(cliente_anonimo, materia_con_inscripcion):
    assert cliente_anonimo.get(url(materia_con_inscripcion)).status_code == 401


def test_leer_anuncios_de_una_materia_inexistente_o_dada_de_baja_es_404(api_as, admin, materia_con_inscripcion):
    assert api_as(admin).get('/api/materias/999999/anuncios/').status_code == 404

    materia_con_inscripcion.soft_delete()
    assert api_as(admin).get(url(materia_con_inscripcion)).status_code == 404


def test_un_estudiante_dado_de_baja_en_la_materia_no_lee_sus_anuncios(api_as, estudiante, materia_con_inscripcion):
    Inscripcion.objects.filter(estudiante=estudiante.persona).update(estado=Inscripcion.EstadoInscripcion.BAJA)

    assert api_as(estudiante).get(url(materia_con_inscripcion)).status_code == 404


def test_un_estudiante_libre_sigue_leyendo_los_anuncios(api_as, estudiante, materia_con_inscripcion):
    Inscripcion.objects.filter(estudiante=estudiante.persona).update(estado=Inscripcion.EstadoInscripcion.LIBRE)

    assert api_as(estudiante).get(url(materia_con_inscripcion)).status_code == 200


def test_la_lectura_trae_solo_los_anuncios_de_esa_materia(api_as, estudiante, materia_con_inscripcion):
    otra = MateriaFactory()
    _anuncio(materia_con_inscripcion, 'de-esta')
    _anuncio(otra, 'de-otra')
    _anuncio(materia_con_inscripcion, 'general', tipo_notificacion_codigo='GENERAL', alcance='AMBOS')

    respuesta = api_as(estudiante).get(url(materia_con_inscripcion))

    assert [a['titulo'] for a in respuesta.json()] == ['de-esta']


def test_la_lectura_admite_paginar_como_el_listado_general(api_as, profesor, materia_con_inscripcion):
    for i in range(3):
        _anuncio(materia_con_inscripcion, f'a{i}')

    respuesta = api_as(profesor).get(url(materia_con_inscripcion) + '?page=1&page_size=2')

    cuerpo = respuesta.json()
    assert cuerpo['count'] == 3 and len(cuerpo['results']) == 2 and cuerpo['next']


# --- lo que se guarda ---

def test_el_anuncio_se_guarda_en_mongo_con_los_campos_del_contrato(api_as, profesor, materia_con_inscripcion):
    api_as(profesor).post(url(materia_con_inscripcion), CUERPO, format='json')

    doc = _coleccion().find_one({})
    assert doc['titulo'] == CUERPO['titulo']
    assert doc['mensaje'] == CUERPO['mensaje']
    assert doc['tipo_notificacion_codigo'] == 'ANUNCIO'
    assert doc['alcance'] == 'ESTUDIANTES'
    assert doc['materia_id'] == materia_con_inscripcion.pk
    assert isinstance(doc['materia_id'], int)
    assert doc['usuario_origen_id'] == profesor.pk
    assert doc['leida_por'] == []
    assert doc['fecha_creacion']


def test_el_cuerpo_no_puede_cambiar_autor_alcance_tipo_ni_materia(api_as, profesor, materia_con_inscripcion):
    otra = MateriaFactory()
    cuerpo = {**CUERPO, 'usuario_origen_id': 999, 'alcance': 'TODOS', 'tipo_notificacion_codigo': 'URGENTE',
              'materia_id': otra.pk, 'usuario_destino_id': 5}

    api_as(profesor).post(url(materia_con_inscripcion), cuerpo, format='json')

    doc = _coleccion().find_one({})
    assert doc['usuario_origen_id'] == profesor.pk
    assert doc['alcance'] == 'ESTUDIANTES'
    assert doc['tipo_notificacion_codigo'] == 'ANUNCIO'
    assert doc['materia_id'] == materia_con_inscripcion.pk
    assert doc['usuario_destino_id'] != 5


def test_la_respuesta_es_el_mismo_objeto_que_un_elemento_del_listado(api_as, profesor, materia_con_inscripcion):
    cliente = api_as(profesor)

    creado = cliente.post(url(materia_con_inscripcion), CUERPO, format='json').json()
    listado = cliente.get(url(materia_con_inscripcion)).json()

    assert listado == [creado]
    assert creado['tipo_notificacion_codigo'] == 'ANUNCIO'
    assert creado['materia_id'] == materia_con_inscripcion.pk
    assert creado['materia_nombre'] == materia_con_inscripcion.titulo
    assert creado['autor'] == f'{profesor.persona.apellido}, {profesor.persona.nombre}'
    assert creado['leida'] is False


def test_el_anuncio_aparece_en_las_notificaciones_del_inscripto_y_no_en_las_de_otros(
    api_as, profesor, estudiante, estudiante_no_inscripto, materia_con_inscripcion
):
    api_as(profesor).post(url(materia_con_inscripcion), CUERPO, format='json')

    propias = api_as(estudiante).get('/api/notificaciones/').json()
    ajenas = api_as(estudiante_no_inscripto).get('/api/notificaciones/').json()

    assert [n['titulo'] for n in propias] == [CUERPO['titulo']]
    assert ajenas == []


# --- validación ---

@pytest.mark.parametrize('cuerpo,campo,mensaje', [
    ({'mensaje': 'm'}, 'titulo', 'Este campo es obligatorio.'),
    ({'titulo': 't'}, 'mensaje', 'Este campo es obligatorio.'),
    ({'titulo': '   ', 'mensaje': 'm'}, 'titulo', 'Este campo no puede estar vacío.'),
    ({'titulo': 't' * 121, 'mensaje': 'm'}, 'titulo', 'Máximo 120 caracteres.'),
    ({'titulo': 't', 'mensaje': 'm' * 2001}, 'mensaje', 'Máximo 2000 caracteres.'),
])
def test_validacion_por_campo(cuerpo, campo, mensaje, api_as, profesor, materia_con_inscripcion):
    respuesta = api_as(profesor).post(url(materia_con_inscripcion), cuerpo, format='json')

    assert respuesta.status_code == 400
    assert respuesta.json() == {campo: [mensaje]}
    assert _coleccion().count_documents({}) == 0


def test_los_limites_exactos_se_aceptan(api_as, profesor, materia_con_inscripcion):
    cuerpo = {'titulo': 't' * 120, 'mensaje': 'm' * 2000}

    assert api_as(profesor).post(url(materia_con_inscripcion), cuerpo, format='json').status_code == 201


# --- tiempo real ---

def test_publica_anuncio_creado_en_el_grupo_de_la_materia_tras_confirmar(
    api_as, profesor, materia_con_inscripcion, django_capture_on_commit_callbacks
):
    capa = get_channel_layer()
    async_to_sync(capa.group_add)(f'materia_{materia_con_inscripcion.pk}', 'canal-de-prueba')

    with django_capture_on_commit_callbacks(execute=True):
        creado = api_as(profesor).post(url(materia_con_inscripcion), CUERPO, format='json').json()

    evento = async_to_sync(capa.receive)('canal-de-prueba')
    assert evento['tipo'] == 'anuncio.creado'
    assert evento['datos'] == creado
    assert evento['fecha']


def test_no_publica_antes_de_confirmar_la_transaccion(api_as, profesor, materia_con_inscripcion):
    with mock.patch('notificacion.views.publicar') as publicar:
        api_as(profesor).post(url(materia_con_inscripcion), CUERPO, format='json')

    publicar.assert_not_called()  # el test corre dentro de una transacción: el on_commit no se ejecutó


def test_publica_solo_al_grupo_de_la_materia(
    api_as, profesor, materia_con_inscripcion, django_capture_on_commit_callbacks
):
    with mock.patch('notificacion.views.publicar') as publicar:
        with django_capture_on_commit_callbacks(execute=True):
            api_as(profesor).post(url(materia_con_inscripcion), CUERPO, format='json')

    publicar.assert_called_once()
    assert publicar.call_args.args[:2] == (f'materia_{materia_con_inscripcion.pk}', 'anuncio.creado')


def test_si_falla_el_tiempo_real_el_anuncio_igual_se_guarda(
    api_as, profesor, materia_con_inscripcion, django_capture_on_commit_callbacks, caplog
):
    with mock.patch('notificacion.views.publicar', side_effect=RuntimeError('redis caído')):
        with django_capture_on_commit_callbacks(execute=True):
            respuesta = api_as(profesor).post(url(materia_con_inscripcion), CUERPO, format='json')

    assert respuesta.status_code == 201
    assert _coleccion().count_documents({}) == 1
    assert 'tiempo real' in caplog.text


def test_un_pedido_rechazado_no_publica_nada(
    api_as, estudiante, profesor, materia_con_inscripcion, django_capture_on_commit_callbacks
):
    with mock.patch('notificacion.views.publicar') as publicar:
        with django_capture_on_commit_callbacks(execute=True):
            api_as(estudiante).post(url(materia_con_inscripcion), CUERPO, format='json')
            api_as(profesor).post(url(materia_con_inscripcion), {}, format='json')

    publicar.assert_not_called()


# --- MongoDB caído ---

def test_si_mongo_no_responde_al_publicar_responde_503(api_as, profesor, materia_con_inscripcion):
    with mock.patch('notificacion.services.crear', side_effect=PyMongoError('sin servicio')):
        respuesta = api_as(profesor).post(url(materia_con_inscripcion), CUERPO, format='json')

    assert respuesta.status_code == 503
    assert respuesta.json() == {'detail': 'Servicio de notificaciones no disponible.'}


def test_si_mongo_no_responde_al_leer_responde_503(api_as, profesor, materia_con_inscripcion):
    with mock.patch('notificacion.services.listar', side_effect=PyMongoError('sin servicio')):
        respuesta = api_as(profesor).get(url(materia_con_inscripcion))

    assert respuesta.status_code == 503
    assert respuesta.json() == {'detail': 'Servicio de notificaciones no disponible.'}


def test_si_la_relectura_no_encuentra_el_anuncio_responde_201_con_lo_insertado(
    api_as, profesor, materia_con_inscripcion, django_capture_on_commit_callbacks
):
    with mock.patch('notificacion.services.serializar_por_id', return_value=None):
        with mock.patch('notificacion.views.publicar') as publicar:
            with django_capture_on_commit_callbacks(execute=True):
                respuesta = api_as(profesor).post(url(materia_con_inscripcion), CUERPO, format='json')

    assert respuesta.status_code == 201
    assert respuesta.json()['titulo'] == CUERPO['titulo']
    assert respuesta.json()['tipo_notificacion_codigo'] == 'ANUNCIO'
    publicar.assert_called_once()


def test_publicar_con_un_anuncio_vacio_no_hace_nada():
    from notificacion.views import AnunciosMateriaView

    with mock.patch('notificacion.views.publicar') as publicar:
        AnunciosMateriaView._publicar(1, None)

    publicar.assert_not_called()
