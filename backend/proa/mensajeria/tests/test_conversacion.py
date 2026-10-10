"""GET /api/mensajes/conversacion/?materia=&con= (010/T023): hilo entre dos personas en una materia."""
from datetime import datetime, timedelta, timezone

import pytest
from django.core.management import call_command

from academico.tests.factories import InscripcionFactory, MateriaFactory
from mensajeria import repositorio
from notificacion import mongo
from usuario.tests.factories import UsuarioFactory

pytestmark = pytest.mark.django_db

URL = '/api/mensajes/conversacion/'
BASE = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def coleccion_vacia():
    coleccion = mongo.obtener_coleccion(mongo.COLECCION_MENSAJE)
    coleccion.delete_many({})
    yield
    coleccion.delete_many({})


@pytest.fixture
def otro_estudiante(rol_estudiante, materia_con_inscripcion):
    usuario = UsuarioFactory(persona__rol=rol_estudiante)
    InscripcionFactory(materia=materia_con_inscripcion, estudiante=usuario.persona)
    return usuario


def _guardar(materia, remitente, destinatario, minutos=0, asunto='A', **extra):
    id_, _ = repositorio.crear({
        'materia_id': materia.pk, 'remitente_id': remitente.pk, 'destinatario_id': destinatario.pk,
        'asunto': asunto, 'cuerpo': 'C', 'leido': False, 'fecha_baja': None,
        'fecha_creacion': BASE + timedelta(minutes=minutos), **extra,
    })
    return str(id_)


def _pedir(cliente, materia, con):
    return cliente.get(URL, {'materia': materia.pk, 'con': con.pk})


def test_devuelve_el_hilo_en_orden_cronologico_en_ambos_sentidos(
    api_as, materia_con_inscripcion, profesor, estudiante
):
    tercero = _guardar(materia_con_inscripcion, estudiante, profesor, minutos=30, asunto='tercero')
    primero = _guardar(materia_con_inscripcion, profesor, estudiante, minutos=0, asunto='primero')
    segundo = _guardar(materia_con_inscripcion, estudiante, profesor, minutos=10, asunto='segundo')

    como_estudiante = _pedir(api_as(estudiante), materia_con_inscripcion, profesor).json()
    como_profesor = _pedir(api_as(profesor), materia_con_inscripcion, estudiante).json()

    assert [m['id'] for m in como_estudiante] == [primero, segundo, tercero]
    assert [m['id'] for m in como_profesor] == [primero, segundo, tercero]
    assert como_estudiante[0]['remitente']['id'] == profesor.pk
    assert set(como_estudiante[0]) == {
        'id', 'materia', 'remitente', 'destinatario', 'asunto', 'cuerpo', 'fecha_creacion', 'leido',
    }


def test_no_incluye_mensajes_de_terceros_ni_de_otras_materias(
    api_as, materia_con_inscripcion, profesor, estudiante, otro_estudiante
):
    propio = _guardar(materia_con_inscripcion, profesor, estudiante)
    _guardar(materia_con_inscripcion, profesor, otro_estudiante)
    _guardar(materia_con_inscripcion, otro_estudiante, profesor)
    otra_materia = MateriaFactory(profesor=profesor.persona)
    InscripcionFactory(materia=otra_materia, estudiante=estudiante.persona)
    _guardar(otra_materia, profesor, estudiante)

    respuesta = _pedir(api_as(estudiante), materia_con_inscripcion, profesor).json()

    assert [m['id'] for m in respuesta] == [propio]


def test_excluye_los_mensajes_dados_de_baja(api_as, materia_con_inscripcion, profesor, estudiante):
    visible = _guardar(materia_con_inscripcion, profesor, estudiante, minutos=0)
    _guardar(materia_con_inscripcion, estudiante, profesor, minutos=5, fecha_baja=BASE)

    respuesta = _pedir(api_as(profesor), materia_con_inscripcion, estudiante).json()

    assert [m['id'] for m in respuesta] == [visible]


def test_el_estudiante_dado_de_baja_conserva_la_lectura_del_hilo(
    api_as, materia_con_inscripcion, profesor, estudiante
):
    _guardar(materia_con_inscripcion, profesor, estudiante)
    materia_con_inscripcion.inscripciones.update(estado='BAJA')

    respuesta = _pedir(api_as(estudiante), materia_con_inscripcion, profesor)

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 1


def test_devuelve_a_lo_sumo_los_ultimos_200_en_orden(api_as, materia_con_inscripcion, profesor, estudiante):
    for n in range(205):
        _guardar(materia_con_inscripcion, profesor, estudiante, minutos=n, asunto=f'm{n}')

    respuesta = _pedir(api_as(estudiante), materia_con_inscripcion, profesor).json()

    assert len(respuesta) == 200
    assert respuesta[0]['asunto'] == 'm5'
    assert respuesta[-1]['asunto'] == 'm204'


def test_admin_es_403_y_anonimo_401(api_as, cliente_anonimo, admin, materia_con_inscripcion, profesor):
    assert _pedir(api_as(admin), materia_con_inscripcion, profesor).status_code == 403
    assert cliente_anonimo.get(URL, {'materia': materia_con_inscripcion.pk, 'con': profesor.pk}).status_code == 401


def test_estudiante_con_otro_estudiante_es_404(api_as, materia_con_inscripcion, estudiante, otro_estudiante):
    respuesta = _pedir(api_as(estudiante), materia_con_inscripcion, otro_estudiante)

    assert respuesta.status_code == 404
    assert respuesta.json() == {'detail': 'No se encontró la conversación.'}


def test_con_uno_mismo_o_con_un_administrador_se_rechaza(api_as, materia_con_inscripcion, estudiante, admin):
    assert _pedir(api_as(estudiante), materia_con_inscripcion, estudiante).status_code == 404
    assert _pedir(api_as(estudiante), materia_con_inscripcion, admin).status_code == 404


@pytest.mark.parametrize('params', [{}, {'materia': '1'}, {'con': '1'}, {'materia': 'x', 'con': '1'}, {'materia': '1', 'con': 'x'}])
def test_parametros_faltantes_o_invalidos_son_400(api_as, estudiante, params):
    assert api_as(estudiante).get(URL, params).status_code == 400


def test_materia_o_persona_inexistente_es_404(api_as, materia_con_inscripcion, estudiante, profesor):
    cliente = api_as(estudiante)

    assert cliente.get(URL, {'materia': 999999, 'con': profesor.pk}).status_code == 404
    assert cliente.get(URL, {'materia': materia_con_inscripcion.pk, 'con': 999999}).status_code == 404


def test_persona_inexistente_y_pareja_invalida_responden_igual_para_no_sondear_usuarios(
        api_as, materia_con_inscripcion, estudiante, otro_estudiante, admin):
    cliente = api_as(estudiante)
    inexistente = cliente.get(URL, {'materia': materia_con_inscripcion.pk, 'con': 999999})
    invalida = _pedir(cliente, materia_con_inscripcion, otro_estudiante)
    con_admin = _pedir(cliente, materia_con_inscripcion, admin)

    assert inexistente.status_code == invalida.status_code == con_admin.status_code == 404
    assert inexistente.json() == invalida.json() == con_admin.json()


def test_la_ruta_conversacion_no_se_confunde_con_el_id_de_un_mensaje(api_as, estudiante):
    # '<str:pk>/' también aceptaría "conversacion": la ruta específica debe ganar
    assert api_as(estudiante).get('/api/mensajes/conversacion/').status_code == 400


def test_repositorio_listar_conversacion_filtra_ordena_y_limita():
    _doc = {'asunto': 'A', 'cuerpo': 'C', 'leido': False, 'fecha_baja': None}
    for minutos, (de, a) in enumerate([(1, 2), (2, 1), (1, 3), (3, 1)]):
        repositorio.crear({**_doc, 'materia_id': 5, 'remitente_id': de, 'destinatario_id': a,
                           'fecha_creacion': BASE + timedelta(minutes=minutos)})

    docs = repositorio.listar_conversacion(1, 2, materia_id=5)

    assert [(d['remitente_id'], d['destinatario_id']) for d in docs] == [(1, 2), (2, 1)]
    assert len(repositorio.listar_conversacion(1, 2, materia_id=5, limite=1)) == 1
    assert repositorio.listar_conversacion(1, 2, materia_id=6) == []


def test_crear_indices_mongo_incluye_el_de_la_conversacion_y_es_idempotente():
    call_command('crear_indices_mongo')
    call_command('crear_indices_mongo')

    claves = [i['key'] for i in mongo.obtener_coleccion(mongo.COLECCION_MENSAJE).index_information().values()]
    assert [('materia_id', 1), ('remitente_id', 1), ('destinatario_id', 1), ('fecha_creacion', -1), ('_id', -1)] in claves
