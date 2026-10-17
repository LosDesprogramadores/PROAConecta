"""Las consultas de los listados no crecen con la cantidad de filas (C4, TSK142)."""
import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from aula_virtual.models import Actividad, Entrega, Nota
from usuario.tests.factories import PersonaFactory


class Escenario:
    """Datos de la cátedra que crecen de a n filas por listado."""

    def __init__(self, profesor, estudiante, rol_estudiante):
        self.profesor = profesor
        self.estudiante = estudiante
        self.rol_estudiante = rol_estudiante
        self.materia = MateriaFactory(profesor=profesor.persona)
        InscripcionFactory(materia=self.materia, estudiante=estudiante.persona)
        self.actividad = Actividad.objects.create(materia=self.materia, titulo='Base')

    def agregar(self, n):
        for i in range(n):
            materia = MateriaFactory(profesor=self.profesor.persona)
            InscripcionFactory(materia=materia, estudiante=self.estudiante.persona)
            for _ in range(2):
                InscripcionFactory(materia=materia, estudiante=PersonaFactory(rol=self.rol_estudiante))
            Actividad.objects.create(materia=self.materia, titulo=f'Actividad {materia.pk}')
            alumno = PersonaFactory(rol=self.rol_estudiante)
            InscripcionFactory(materia=self.materia, estudiante=alumno)
            entrega = Entrega.objects.create(actividad=self.actividad, estudiante=alumno, contenido_texto='x')
            Nota.objects.create(entrega=entrega, profesor=self.profesor.persona, calificacion=8)


ENDPOINTS = [
    ('materias-admin', 'admin', lambda e: '/api/materias/'),
    ('materias-profesor', 'profesor', lambda e: '/api/materias/'),
    ('materias-estudiante', 'estudiante', lambda e: '/api/materias/'),
    ('materias-por-estudiante', 'estudiante', lambda e: f'/api/materias/por-estudiante/{e.estudiante.persona.pk}/'),
    ('inscripciones-admin', 'admin', lambda e: '/api/inscripciones/'),
    ('inscripciones-estudiante', 'estudiante', lambda e: f'/api/inscripciones/?estudiante={e.estudiante.persona.pk}'),
    ('actividades-profesor', 'profesor', lambda e: f'/api/actividades/?materia={e.materia.pk}'),
    ('actividades-estudiante', 'estudiante', lambda e: f'/api/actividades/?materia={e.materia.pk}'),
    ('entregas-de-actividad', 'profesor', lambda e: f'/api/actividades/{e.actividad.pk}/entregas/'),
    ('entregas-listado', 'profesor', lambda e: f'/api/entregas/?actividad={e.actividad.pk}'),
    ('alumnos', 'profesor', lambda e: f'/api/materias/{e.materia.pk}/alumnos/'),
    ('rendimiento-curso', 'profesor', lambda e: f'/api/materias/{e.materia.pk}/rendimiento-curso/'),
]
PRESUPUESTO_DE_CONSULTAS = 5


def _consultas(cliente, ruta):
    with CaptureQueriesContext(connection) as capturadas:
        respuesta = cliente.get(ruta)
    assert respuesta.status_code == 200, ruta
    return len(capturadas)


@pytest.fixture
def escenario(profesor, estudiante, rol_estudiante):
    return Escenario(profesor, estudiante, rol_estudiante)


@pytest.mark.django_db
@pytest.mark.parametrize('nombre,quien,ruta', ENDPOINTS, ids=[e[0] for e in ENDPOINTS])
def test_las_consultas_no_crecen_con_la_cantidad_de_filas(nombre, quien, ruta, request, api_as, escenario):
    cliente = api_as(request.getfixturevalue(quien))
    escenario.agregar(2)
    pocas = _consultas(cliente, ruta(escenario))

    escenario.agregar(10)
    muchas = _consultas(cliente, ruta(escenario))

    assert muchas == pocas, f'{nombre}: {pocas} consultas con 3 filas y {muchas} con 13'
    assert muchas <= PRESUPUESTO_DE_CONSULTAS


@pytest.mark.django_db
def test_listado_de_materias_con_doce_filas_cabe_en_el_presupuesto(
    api_as, admin, escenario, django_assert_max_num_queries
):
    escenario.agregar(11)

    with django_assert_max_num_queries(PRESUPUESTO_DE_CONSULTAS):
        respuesta = api_as(admin).get('/api/materias/')

    assert len(respuesta.json()) == 12


@pytest.mark.django_db
def test_total_estudiantes_no_cuenta_bajas(api_as, admin, escenario):
    for _ in range(2):
        InscripcionFactory(materia=escenario.materia, estudiante=PersonaFactory(rol=escenario.rol_estudiante))
    InscripcionFactory(
        materia=escenario.materia,
        estudiante=PersonaFactory(rol=escenario.rol_estudiante),
        estado=Inscripcion.EstadoInscripcion.BAJA,
    )
    InscripcionFactory(
        materia=escenario.materia,
        estudiante=PersonaFactory(rol=escenario.rol_estudiante),
        estado=Inscripcion.EstadoInscripcion.LIBRE,
    )

    fila = next(f for f in api_as(admin).get('/api/materias/').json() if f['id'] == escenario.materia.pk)

    # 1 del escenario + 2 cursando + 1 libre; la baja no cuenta
    assert fila['total_estudiantes'] == 4


@pytest.mark.django_db
def test_cantidad_entregas_no_cuenta_las_dadas_de_baja(api_as, profesor, escenario):
    for _ in range(2):
        PersonaFactory(rol=escenario.rol_estudiante)
        Entrega.objects.create(
            actividad=escenario.actividad, estudiante=PersonaFactory(rol=escenario.rol_estudiante), contenido_texto='x'
        )
    Entrega.objects.create(
        actividad=escenario.actividad,
        estudiante=PersonaFactory(rol=escenario.rol_estudiante),
        contenido_texto='x',
        fecha_baja=timezone.now(),
    )

    respuesta = api_as(profesor).get(f'/api/actividades/?materia={escenario.materia.pk}')

    assert respuesta.json()[0]['cantidad_entregas'] == 2


@pytest.mark.django_db
def test_actividad_creada_informa_cantidad_de_entregas_sin_anotacion(api_as, profesor, escenario):
    # La respuesta de un alta no pasa por el listado anotado: el serializer calcula la cuenta solo
    respuesta = api_as(profesor).post(
        '/api/actividades/',
        {'materia': escenario.materia.pk, 'titulo': 'Nueva', 'estado': 'BORRADOR'},
        format='json',
    )

    assert respuesta.status_code == 201
    assert respuesta.json()['cantidad_entregas'] == 0
