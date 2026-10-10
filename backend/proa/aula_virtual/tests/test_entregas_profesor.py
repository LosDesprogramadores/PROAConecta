"""Listado de entregas del profesor con materia y actividad, y filtros (TSK192, #322)."""
import pytest

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from aula_virtual.models import Actividad, Entrega, Nota
from usuario.tests.factories import PersonaFactory, UsuarioFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def materia(profesor):
    return MateriaFactory(profesor=profesor.persona, titulo='Historia')


@pytest.fixture
def actividad(materia):
    return Actividad.objects.create(materia=materia, titulo='TP Historia')


def _entrega(actividad, rol_estudiante, estado_inscripcion=Inscripcion.EstadoInscripcion.CURSANDO, nota=None):
    alumno = PersonaFactory(rol=rol_estudiante)
    InscripcionFactory(materia=actividad.materia, estudiante=alumno, estado=estado_inscripcion)
    entrega = Entrega.objects.create(actividad=actividad, estudiante=alumno, contenido_texto='x')
    if nota is not None:
        Nota.objects.create(entrega=entrega, calificacion=nota)
    return entrega


def _ids(respuesta):
    cuerpo = respuesta.json()
    filas = cuerpo['results'] if isinstance(cuerpo, dict) else cuerpo
    return {f['id'] for f in filas}


def test_cada_entrega_trae_actividad_y_materia(api_as, profesor, actividad, materia, rol_estudiante):
    entrega = _entrega(actividad, rol_estudiante)

    (fila,) = api_as(profesor).get('/api/entregas/').json()

    assert fila['id'] == entrega.pk
    assert fila['actividad_titulo'] == 'TP Historia'
    assert fila['materia_id'] == materia.pk
    assert fila['materia_titulo'] == 'Historia'


def test_los_campos_anteriores_no_cambian(api_as, profesor, actividad, rol_estudiante):
    _entrega(actividad, rol_estudiante)

    (fila,) = api_as(profesor).get('/api/entregas/').json()

    assert {
        'id', 'actividad', 'estudiante', 'estudiante_nombre', 'archivo', 'enlace', 'contenido_texto',
        'fuera_de_termino', 'estado', 'fecha_entrega', 'fecha_baja', 'nota',
    } <= set(fila)
    assert fila['actividad'] == actividad.pk


def test_filtro_calificada(api_as, profesor, actividad, rol_estudiante):
    sin_nota = _entrega(actividad, rol_estudiante)
    con_nota = _entrega(actividad, rol_estudiante, nota=8)
    cliente = api_as(profesor)

    assert _ids(cliente.get('/api/entregas/?calificada=false')) == {sin_nota.pk}
    assert _ids(cliente.get('/api/entregas/?calificada=true')) == {con_nota.pk}
    assert _ids(cliente.get('/api/entregas/')) == {sin_nota.pk, con_nota.pk}


def test_filtro_materia(api_as, profesor, actividad, rol_estudiante):
    esta = _entrega(actividad, rol_estudiante)
    otra_materia = MateriaFactory(profesor=profesor.persona)
    otra = _entrega(Actividad.objects.create(materia=otra_materia, titulo='Otra'), rol_estudiante)
    cliente = api_as(profesor)

    assert _ids(cliente.get(f'/api/entregas/?materia={actividad.materia_id}')) == {esta.pk}
    assert _ids(cliente.get(f'/api/entregas/?materia={otra_materia.pk}')) == {otra.pk}


def test_materia_no_numerica_es_400(api_as, profesor):
    assert api_as(profesor).get('/api/entregas/?materia=abc').status_code == 400


def test_filtros_combinados(api_as, profesor, actividad, rol_estudiante):
    _entrega(actividad, rol_estudiante, nota=9)
    pendiente = _entrega(actividad, rol_estudiante)

    r = api_as(profesor).get(f'/api/entregas/?materia={actividad.materia_id}&calificada=false')

    assert _ids(r) == {pendiente.pk}


def test_listado_excluye_entregas_de_inscripcion_en_baja(api_as, profesor, actividad, rol_estudiante):
    visible = _entrega(actividad, rol_estudiante)
    _entrega(actividad, rol_estudiante, estado_inscripcion=Inscripcion.EstadoInscripcion.BAJA)
    libre = _entrega(actividad, rol_estudiante, estado_inscripcion=Inscripcion.EstadoInscripcion.LIBRE)

    r = api_as(profesor).get('/api/entregas/?page=1')

    assert r.json()['count'] == 2
    assert _ids(r) == {visible.pk, libre.pk}


def test_detalle_y_calificar_siguen_disponibles_para_inscripcion_en_baja(api_as, profesor, actividad, rol_estudiante):
    en_baja = _entrega(
        actividad, rol_estudiante, estado_inscripcion=Inscripcion.EstadoInscripcion.BAJA, nota=5
    )
    cliente = api_as(profesor)

    assert en_baja.pk not in _ids(cliente.get('/api/entregas/'))
    assert cliente.get(f'/api/entregas/{en_baja.pk}/').status_code == 200
    r = cliente.post(f'/api/entregas/{en_baja.pk}/calificar/', {'calificacion': 8}, format='json')
    assert r.status_code == 200
    en_baja.nota.refresh_from_db()
    assert en_baja.nota.calificacion == 8


def test_calificada_invalida_es_400_con_detail(api_as, profesor):
    r = api_as(profesor).get('/api/entregas/?calificada=quizas')

    assert r.status_code == 400
    assert 'detail' in r.json()


def test_materia_no_numerica_tiene_la_misma_forma_de_error(api_as, profesor):
    assert set(api_as(profesor).get('/api/entregas/?materia=abc').json()) == {'detail'}
    assert set(api_as(profesor).get('/api/entregas/?calificada=x').json()) == {'detail'}


def test_sobre_paginado_con_page_y_page_size(api_as, profesor, actividad, rol_estudiante):
    for _ in range(3):
        _entrega(actividad, rol_estudiante)

    r = api_as(profesor).get('/api/entregas/?calificada=false&page=1&page_size=2')

    cuerpo = r.json()
    assert r.status_code == 200
    assert set(cuerpo) == {'count', 'next', 'previous', 'results'}
    assert cuerpo['count'] == 3 and len(cuerpo['results']) == 2 and cuerpo['next']


def test_sin_page_responde_el_arreglo_de_siempre(api_as, profesor, actividad, rol_estudiante):
    _entrega(actividad, rol_estudiante)

    assert isinstance(api_as(profesor).get('/api/entregas/').json(), list)


def test_el_profesor_solo_ve_las_de_sus_materias(api_as, profesor, actividad, rol_estudiante, rol_profesor):
    propia = _entrega(actividad, rol_estudiante)
    ajena_materia = MateriaFactory(profesor=UsuarioFactory(persona__rol=rol_profesor).persona)
    _entrega(Actividad.objects.create(materia=ajena_materia, titulo='Ajena'), rol_estudiante)

    assert _ids(api_as(profesor).get('/api/entregas/')) == {propia.pk}


def test_el_estudiante_solo_ve_las_suyas(api_as, estudiante, actividad, rol_estudiante):
    InscripcionFactory(materia=actividad.materia, estudiante=estudiante.persona)
    mia = Entrega.objects.create(actividad=actividad, estudiante=estudiante.persona, contenido_texto='x')
    _entrega(actividad, rol_estudiante)

    r = api_as(estudiante).get('/api/entregas/')

    assert _ids(r) == {mia.pk}
    assert r.json()[0]['materia_titulo'] == 'Historia'


def test_el_admin_ve_todas(api_as, admin, actividad, rol_estudiante):
    a = _entrega(actividad, rol_estudiante)
    otra = _entrega(
        Actividad.objects.create(materia=MateriaFactory(titulo='Otra materia'), titulo='Otra'), rol_estudiante
    )

    assert _ids(api_as(admin).get('/api/entregas/')) == {a.pk, otra.pk}


@pytest.mark.parametrize('cantidad', [1, 10])
def test_presupuesto_de_consultas_constante(
    api_as, profesor, actividad, rol_estudiante, cantidad, django_assert_max_num_queries
):
    for _ in range(cantidad):
        _entrega(actividad, rol_estudiante, nota=7)

    with django_assert_max_num_queries(6):
        r = api_as(profesor).get('/api/entregas/')

    assert len(r.json()) == cantidad
