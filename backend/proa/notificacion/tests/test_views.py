import pytest

from notificacion import mongo

URL = '/api/notificaciones/'
CUERPO = {'titulo': 'Aviso', 'mensaje': 'Hola'}


@pytest.fixture(autouse=True)
def coleccion_vacia():
    # El cliente de mongomock es compartido por toda la sesión de tests
    mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION).delete_many({})
    yield
    mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION).delete_many({})


def _coleccion():
    return mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION)


def test_estudiante_no_puede_crear(api_as, estudiante):
    assert api_as(estudiante).post(URL, CUERPO, format='json').status_code == 403
    assert _coleccion().count_documents({}) == 0


def test_profesor_no_puede_crear(api_as, profesor):
    assert api_as(profesor).post(URL, CUERPO, format='json').status_code == 403


def test_administrador_puede_crear(api_as, admin):
    assert api_as(admin).post(URL, CUERPO, format='json').status_code == 201


def test_anonimo_no_puede_crear(cliente_anonimo):
    assert cliente_anonimo.post(URL, CUERPO, format='json').status_code == 401


def test_estudiante_y_profesor_siguen_listando(api_as, estudiante, profesor):
    assert api_as(estudiante).get(URL).status_code == 200
    assert api_as(profesor).get(URL).status_code == 200


def test_editar_y_borrar_requieren_administrador(api_as, estudiante, profesor, admin):
    id_ = str(_coleccion().insert_one({'titulo': 'x'}).inserted_id)
    for usuario in (estudiante, profesor):
        assert api_as(usuario).put(f'{URL}{id_}/', {'titulo': 'y'}, format='json').status_code == 403
        assert api_as(usuario).delete(f'{URL}{id_}/').status_code == 403
    assert api_as(admin).put(f'{URL}{id_}/', {'titulo': 'y'}, format='json').status_code == 200
    assert api_as(admin).delete(f'{URL}{id_}/').status_code == 200


@pytest.mark.parametrize('campo', ['materia_id', 'usuario_destino_id'])
def test_ids_invalidos_dan_400_sin_insertar(api_as, admin, campo):
    respuesta = api_as(admin).post(URL, {**CUERPO, campo: 'abc'}, format='json')
    assert respuesta.status_code == 400
    assert 'detail' in respuesta.json()
    assert _coleccion().count_documents({}) == 0


def test_si_publicar_falla_responde_201_con_un_solo_documento(api_as, admin, monkeypatch):
    def falla(*args, **kwargs):
        raise ConnectionError('redis caído')

    monkeypatch.setattr('notificacion.views.publicar', falla)
    respuesta = api_as(admin).post(URL, {**CUERPO, 'materia_id': 7}, format='json')
    assert respuesta.status_code == 201
    assert _coleccion().count_documents({}) == 1
