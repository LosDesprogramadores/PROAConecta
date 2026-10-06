import pytest

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from aula_virtual.models import Actividad
from core.pagination import PaginacionOpcional
from usuario.tests.factories import PersonaFactory

pytestmark = pytest.mark.django_db


def test_la_clase_define_50_por_pagina_y_maximo_200():
    assert PaginacionOpcional.page_size == 50
    assert PaginacionOpcional.max_page_size == 200
    assert PaginacionOpcional.page_size_query_param == 'page_size'


@pytest.fixture
def veinte_materias():
    for _ in range(20):
        MateriaFactory()


# --- Sin ?page: el arreglo de siempre ---

def test_sin_page_devuelve_el_arreglo_completo(api_as, admin, veinte_materias):
    respuesta = api_as(admin).get('/api/materias/')
    assert respuesta.status_code == 200
    assert isinstance(respuesta.json(), list)
    assert len(respuesta.json()) == 20


def test_page_size_sin_page_no_activa_la_paginacion(api_as, admin, veinte_materias):
    respuesta = api_as(admin).get('/api/materias/', {'page_size': 5})
    assert isinstance(respuesta.json(), list)
    assert len(respuesta.json()) == 20


# --- Con ?page: sobre count/next/previous/results ---

def test_con_page_devuelve_el_sobre(api_as, admin, veinte_materias):
    respuesta = api_as(admin).get('/api/materias/', {'page': 1, 'page_size': 8})
    cuerpo = respuesta.json()
    assert respuesta.status_code == 200
    assert set(cuerpo) == {'count', 'next', 'previous', 'results'}
    assert cuerpo['count'] == 20
    assert len(cuerpo['results']) == 8
    assert cuerpo['previous'] is None
    assert 'page=2' in cuerpo['next']


def test_la_ultima_pagina_trae_el_resto_y_no_tiene_siguiente(api_as, admin, veinte_materias):
    cuerpo = api_as(admin).get('/api/materias/', {'page': 3, 'page_size': 8}).json()
    assert len(cuerpo['results']) == 4
    assert cuerpo['next'] is None
    assert cuerpo['previous'] is not None


def test_el_tamano_por_defecto_es_50(api_as, admin):
    for _ in range(55):
        MateriaFactory()
    cuerpo = api_as(admin).get('/api/materias/', {'page': 1}).json()
    assert len(cuerpo['results']) == 50
    assert cuerpo['count'] == 55


def test_el_tamano_se_recorta_a_200(api_as, admin):
    for _ in range(205):
        MateriaFactory()
    cuerpo = api_as(admin).get('/api/materias/', {'page': 1, 'page_size': 500}).json()
    assert len(cuerpo['results']) == 200


def test_page_size_no_numerico_usa_el_defecto(api_as, admin, veinte_materias):
    cuerpo = api_as(admin).get('/api/materias/', {'page': 1, 'page_size': 'abc'}).json()
    assert len(cuerpo['results']) == 20


def test_pagina_fuera_de_rango_es_404_con_detail(api_as, admin, veinte_materias):
    respuesta = api_as(admin).get('/api/materias/', {'page': 99})
    assert respuesta.status_code == 404
    assert 'detail' in respuesta.json()


def test_las_paginas_no_repiten_ni_pierden_registros(api_as, admin, veinte_materias):
    cliente = api_as(admin)
    vistos = []
    for pagina in (1, 2, 3, 4):
        vistos += [m['id'] for m in cliente.get('/api/materias/', {'page': pagina, 'page_size': 5}).json()['results']]
    assert len(vistos) == len(set(vistos)) == 20


def test_la_paginacion_respeta_el_alcance_por_rol(api_as, profesor, veinte_materias):
    propia = MateriaFactory(profesor=profesor.persona)
    cuerpo = api_as(profesor).get('/api/materias/', {'page': 1}).json()
    assert cuerpo['count'] == 1
    assert cuerpo['results'][0]['id'] == propia.id


# --- Los demás listados principales, en los dos modos ---

def test_personas_en_los_dos_modos(api_as, admin, rol_estudiante):
    for _ in range(6):
        PersonaFactory(rol=rol_estudiante)
    cliente = api_as(admin)
    total = len(cliente.get('/api/personas/').json())  # incluye a la persona del admin
    assert total >= 7
    cuerpo = cliente.get('/api/personas/', {'page': 1, 'page_size': 4}).json()
    assert cuerpo['count'] == total
    assert len(cuerpo['results']) == 4


def test_personas_por_rol_en_los_dos_modos(api_as, admin, rol_estudiante):
    for _ in range(5):
        PersonaFactory(rol=rol_estudiante)
    cliente = api_as(admin)
    assert len(cliente.get('/api/personas/rol/', {'rol': rol_estudiante.id}).json()) == 5
    cuerpo = cliente.get('/api/personas/rol/', {'rol': rol_estudiante.id, 'page': 2, 'page_size': 2}).json()
    assert cuerpo['count'] == 5
    assert len(cuerpo['results']) == 2


def test_personas_por_rol_sigue_exigiendo_el_rol_con_page(api_as, admin):
    respuesta = api_as(admin).get('/api/personas/rol/', {'page': 1})
    assert respuesta.status_code == 400


def test_inscripciones_en_los_dos_modos(api_as, admin):
    materia = MateriaFactory()
    for _ in range(6):
        InscripcionFactory(materia=materia)
    cliente = api_as(admin)
    assert len(cliente.get('/api/inscripciones/').json()) == 6
    cuerpo = cliente.get('/api/inscripciones/', {'page': 1, 'page_size': 4}).json()
    assert cuerpo['count'] == 6
    assert len(cuerpo['results']) == 4


def test_actividades_en_los_dos_modos(api_as, admin):
    materia = MateriaFactory()
    for i in range(6):
        Actividad.objects.create(materia=materia, titulo=f'A{i}', descripcion='x', estado=Actividad.EstadoActividad.PUBLICADA)
    cliente = api_as(admin)
    assert len(cliente.get('/api/actividades/', {'materia': materia.id}).json()) == 6
    cuerpo = cliente.get('/api/actividades/', {'materia': materia.id, 'page': 2, 'page_size': 4}).json()
    assert cuerpo['count'] == 6
    assert len(cuerpo['results']) == 2
