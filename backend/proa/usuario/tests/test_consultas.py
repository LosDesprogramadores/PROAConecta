"""Las consultas de los listados de usuario no crecen con la cantidad de filas (TSK198, #329)."""
import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from usuario.tests.factories import PersonaFactory, RolFactory

pytestmark = pytest.mark.django_db

PRESUPUESTO_DE_CONSULTAS = 8


class Escenario:
    """Personas y roles que crecen de a n filas por listado."""

    def __init__(self, rol_estudiante, rol_profesor):
        self.rol_estudiante = rol_estudiante
        self.rol_profesor = rol_profesor
        self.contador = 0

    def agregar(self, n):
        for _ in range(n):
            self.contador += 1
            PersonaFactory(rol=self.rol_estudiante)
            PersonaFactory(rol=self.rol_profesor)
            RolFactory(nombre=f'Rol extra {self.contador}')


ENDPOINTS = [
    ('personas', 'admin', lambda e: '/api/personas/'),
    ('personas-paginado', 'admin', lambda e: '/api/personas/?page=1&page_size=200'),
    ('personas-como-profesor', 'profesor', lambda e: '/api/personas/'),
    ('personas-como-estudiante', 'estudiante', lambda e: '/api/personas/'),
    ('personas-por-rol', 'admin', lambda e: f'/api/personas/rol/?rol={e.rol_estudiante.pk}'),
    ('personas-por-rol-paginado', 'admin', lambda e: f'/api/personas/rol/?rol={e.rol_estudiante.pk}&page=1&page_size=200'),
    ('personas-por-rol-como-profesor', 'profesor', lambda e: f'/api/personas/rol/?rol={e.rol_profesor.pk}'),
    ('personas-por-rol-como-estudiante', 'estudiante', lambda e: f'/api/personas/rol/?rol={e.rol_profesor.pk}'),
    ('roles', 'admin', lambda e: '/api/roles/'),
    ('roles-paginado', 'admin', lambda e: '/api/roles/?page=1&page_size=200'),
    ('roles-como-estudiante', 'estudiante', lambda e: '/api/roles/'),
]


def _consultas(cliente, ruta):
    with CaptureQueriesContext(connection) as capturadas:
        respuesta = cliente.get(ruta)
    assert respuesta.status_code == 200, ruta
    cuerpo = respuesta.json()
    filas = cuerpo['results'] if isinstance(cuerpo, dict) else cuerpo
    return len(capturadas), len(filas)


@pytest.fixture
def escenario(rol_estudiante, rol_profesor):
    return Escenario(rol_estudiante, rol_profesor)


@pytest.mark.parametrize('nombre,quien,ruta', ENDPOINTS, ids=[e[0] for e in ENDPOINTS])
def test_las_consultas_no_crecen_con_la_cantidad_de_filas(nombre, quien, ruta, request, api_as, escenario):
    cliente = api_as(request.getfixturevalue(quien))
    escenario.agregar(1)
    pocas, filas_pocas = _consultas(cliente, ruta(escenario))

    escenario.agregar(9)
    muchas, filas_muchas = _consultas(cliente, ruta(escenario))

    # El listado tiene que crecer de verdad para que la comparación pruebe algo
    assert filas_muchas >= filas_pocas + 9, nombre
    assert muchas == pocas, f'{nombre}: {pocas} consultas con 1 fila y {muchas} con 10'
    assert muchas <= PRESUPUESTO_DE_CONSULTAS
