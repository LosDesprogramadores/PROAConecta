import pytest

from academico.tests.factories import MateriaFactory, crear_actividad
from usuario.tests.factories import UsuarioFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def materia_ajena(rol_profesor):
    titular = UsuarioFactory(persona__rol=rol_profesor)
    materia = MateriaFactory(profesor=titular.persona)
    crear_actividad(materia, 'Actividad de la materia ajena')
    return materia


def test_profesor_ajeno_recibe_404_y_no_una_lista_vacia(api_as, profesor, materia_ajena):
    respuesta = api_as(profesor).get(f'/api/actividades/?materia={materia_ajena.id}')

    assert respuesta.status_code == 404
    assert 'detail' in respuesta.json()


def test_profesor_ajeno_recibe_404_tambien_en_la_papelera(api_as, profesor, materia_ajena):
    assert api_as(profesor).get(f'/api/actividades/?materia={materia_ajena.id}&papelera=true').status_code == 404


def test_profesor_ajeno_recibe_404_en_el_rendimiento_del_curso(api_as, profesor, materia_ajena):
    assert api_as(profesor).get(f'/api/materias/{materia_ajena.id}/rendimiento-curso/').status_code == 404


def test_materia_inexistente_es_404_para_el_profesor(api_as, profesor):
    assert api_as(profesor).get('/api/actividades/?materia=99999').status_code == 404


def test_profesor_titular_ve_sus_actividades(api_as, profesor):
    propia = MateriaFactory(profesor=profesor.persona)
    crear_actividad(propia, 'Propia')

    respuesta = api_as(profesor).get(f'/api/actividades/?materia={propia.id}')

    assert respuesta.status_code == 200
    assert [a['titulo'] for a in respuesta.json()] == ['Propia']


def test_titular_con_materia_sin_actividades_recibe_lista_vacia_no_404(api_as, profesor):
    propia = MateriaFactory(profesor=profesor.persona)
    respuesta = api_as(profesor).get(f'/api/actividades/?materia={propia.id}')
    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_profesor_sin_filtro_de_materia_sigue_viendo_solo_lo_suyo(api_as, profesor, materia_ajena):
    propia = MateriaFactory(profesor=profesor.persona)
    crear_actividad(propia, 'Propia')

    titulos = [a['titulo'] for a in api_as(profesor).get('/api/actividades/').json()]

    assert titulos == ['Propia']


def test_admin_ve_las_actividades_de_cualquier_materia(api_as, admin, materia_ajena):
    respuesta = api_as(admin).get(f'/api/actividades/?materia={materia_ajena.id}')
    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 1


def test_el_estudiante_no_cambia_su_comportamiento(api_as, estudiante, materia_ajena):
    respuesta = api_as(estudiante).get(f'/api/actividades/?materia={materia_ajena.id}')
    assert respuesta.status_code == 200
    assert respuesta.json() == []


@pytest.mark.parametrize('rol', ['admin', 'profesor', 'estudiante'])
def test_materia_no_numerica_devuelve_400_con_detail(api_as, request, rol):
    respuesta = api_as(request.getfixturevalue(rol)).get('/api/actividades/?materia=abc')
    assert respuesta.status_code == 400
    assert 'detail' in respuesta.json()
