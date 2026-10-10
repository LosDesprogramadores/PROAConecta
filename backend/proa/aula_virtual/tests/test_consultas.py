"""Las consultas de los listados de aula_virtual no crecen con la cantidad de filas (TSK193, #323)."""
import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from academico.tests.factories import InscripcionFactory, MateriaFactory
from aula_virtual.models import Actividad, Entrega, Material, Nota, Unidad
from usuario.tests.factories import PersonaFactory

pytestmark = pytest.mark.django_db

PRESUPUESTO_DE_CONSULTAS = 8


class Escenario:
    """Datos de una materia que crecen de a n filas por listado."""

    def __init__(self, profesor, estudiante, rol_estudiante):
        self.profesor = profesor
        self.estudiante = estudiante
        self.rol_estudiante = rol_estudiante
        self.materia = MateriaFactory(profesor=profesor.persona)
        InscripcionFactory(materia=self.materia, estudiante=estudiante.persona)
        self.unidad = Unidad.objects.create(materia=self.materia, titulo='Base', orden=0)
        self.actividad = Actividad.objects.create(materia=self.materia, titulo='Base', unidad=self.unidad)
        self.contador = 0

    def agregar(self, n):
        for _ in range(n):
            self.contador += 1
            i = self.contador
            unidad = Unidad.objects.create(materia=self.materia, titulo=f'Unidad {i}', orden=i)
            Material.objects.create(
                materia=self.materia, unidad=unidad, titulo=f'Material {i}', tipo=Material.TipoContenido.ENLACE,
                enlace='https://ejemplo.test',
            )
            Actividad.objects.create(materia=self.materia, unidad=unidad, titulo=f'Actividad {i}')
            alumno = PersonaFactory(rol=self.rol_estudiante)
            InscripcionFactory(materia=self.materia, estudiante=alumno)
            entrega = Entrega.objects.create(actividad=self.actividad, estudiante=alumno, contenido_texto='x')
            Nota.objects.create(entrega=entrega, profesor=self.profesor.persona, calificacion=8)


ENDPOINTS = [
    ('unidades-profesor', 'profesor', lambda e: f'/api/unidades/?materia={e.materia.pk}'),
    ('unidades-estudiante', 'estudiante', lambda e: f'/api/unidades/?materia={e.materia.pk}'),
    ('materiales-profesor', 'profesor', lambda e: f'/api/materiales/?materia={e.materia.pk}'),
    ('materiales-estudiante', 'estudiante', lambda e: f'/api/materiales/?materia={e.materia.pk}'),
    ('actividades-profesor', 'profesor', lambda e: f'/api/actividades/?materia={e.materia.pk}'),
    ('actividades-estudiante', 'estudiante', lambda e: f'/api/actividades/?materia={e.materia.pk}'),
    ('actividades-paginado', 'profesor', lambda e: f'/api/actividades/?materia={e.materia.pk}&page=1'),
    ('entregas-profesor', 'profesor', lambda e: '/api/entregas/'),
    ('entregas-profesor-filtros', 'profesor',
     lambda e: f'/api/entregas/?materia={e.materia.pk}&calificada=true&page=1'),
    ('entregas-admin', 'admin', lambda e: '/api/entregas/'),
    ('entregas-de-actividad', 'profesor', lambda e: f'/api/actividades/{e.actividad.pk}/entregas/'),
    ('seguimiento', 'profesor', lambda e: f'/api/actividades/{e.actividad.pk}/seguimiento/'),
]


def _consultas(cliente, ruta):
    with CaptureQueriesContext(connection) as capturadas:
        respuesta = cliente.get(ruta)
    assert respuesta.status_code == 200, ruta
    cuerpo = respuesta.json()
    filas = cuerpo.get('results', cuerpo.get('estudiantes')) if isinstance(cuerpo, dict) else cuerpo
    return len(capturadas), len(filas)


@pytest.fixture
def escenario(profesor, estudiante, rol_estudiante):
    return Escenario(profesor, estudiante, rol_estudiante)


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
