import pytest

from academico.models import Inscripcion, Materia
from academico.tests.factories import InscripcionFactory, MateriaFactory
from usuario.tests.factories import UsuarioFactory

MATERIAS = '/api/materias/'
INSCRIPCIONES = '/api/inscripciones/'

pytestmark = pytest.mark.django_db


@pytest.fixture
def ajena(rol_profesor):
    # Materia de otro profesor, con un alumno propio
    otro = UsuarioFactory(persona__rol=rol_profesor)
    return MateriaFactory(profesor=otro.persona)


@pytest.fixture
def otro_estudiante(rol_estudiante):
    return UsuarioFactory(persona__rol=rol_estudiante)


def _ids(respuesta):
    return {item['id'] for item in respuesta.json()}


# --- Escrituras: solo administrador (exploits desde profesor y estudiante) ---

def _escrituras(materia, estudiante, profesor):
    return [
        ('post', MATERIAS, {'titulo': 'X', 'anio': 2026, 'curso': '1ro A'}),
        ('patch', f'{MATERIAS}{materia.id}/', {'titulo': 'Hackeada'}),
        ('put', f'{MATERIAS}{materia.id}/', {'titulo': 'Hackeada', 'anio': 2026, 'curso': '1ro A'}),
        ('delete', f'{MATERIAS}{materia.id}/', None),
        ('post', f'{MATERIAS}asignar-profesor/',
         {'profesor_id': profesor.persona.id, 'materia_ids': [materia.id]}),
        ('patch', f'{MATERIAS}{materia.id}/desasignar-profesor/', None),
        ('post', INSCRIPCIONES, {'materia': materia.id, 'estudiante': estudiante.persona.id}),
        ('delete', f'{INSCRIPCIONES}{Inscripcion.objects.filter(materia=materia).first().id}/', None),
        ('post', f'{INSCRIPCIONES}inscribir/',
         {'estudiante_id': estudiante.persona.id, 'materia_ids': [materia.id]}),
        ('post', f'{INSCRIPCIONES}desinscribir/',
         {'estudiante_id': estudiante.persona.id, 'materia_id': materia.id}),
    ]


@pytest.mark.parametrize('rol', ['profesor', 'estudiante'])
def test_no_administradores_reciben_403_en_toda_escritura(api_as, rol, request, materia_con_inscripcion,
                                                          profesor, estudiante):
    usuario = request.getfixturevalue(rol)
    cliente = api_as(usuario)
    for metodo, url, cuerpo in _escrituras(materia_con_inscripcion, estudiante, profesor):
        respuesta = getattr(cliente, metodo)(url, cuerpo, format='json')
        assert respuesta.status_code == 403, f'{metodo.upper()} {url} -> {respuesta.status_code}'
    # Nada cambió
    materia_con_inscripcion.refresh_from_db()
    assert materia_con_inscripcion.profesor == profesor.persona
    assert Inscripcion.objects.filter(materia=materia_con_inscripcion).count() == 1


def test_anonimo_recibe_401_en_escrituras(cliente_anonimo, materia_con_inscripcion, estudiante, profesor):
    for metodo, url, cuerpo in _escrituras(materia_con_inscripcion, estudiante, profesor):
        assert getattr(cliente_anonimo, metodo)(url, cuerpo, format='json').status_code == 401


def test_administrador_conserva_las_escrituras(api_as, admin, materia_con_inscripcion, otro_estudiante, profesor):
    cliente = api_as(admin)
    materia = materia_con_inscripcion
    assert cliente.post(MATERIAS, {'titulo': 'Nueva', 'anio': 2026, 'curso': '2do B'}, format='json').status_code == 201
    assert cliente.patch(f'{MATERIAS}{materia.id}/', {'titulo': 'Editada'}, format='json').status_code == 200
    assert cliente.post(f'{MATERIAS}asignar-profesor/',
                        {'profesor_id': profesor.persona.id, 'materia_ids': [materia.id]},
                        format='json').status_code == 200
    assert cliente.patch(f'{MATERIAS}{materia.id}/desasignar-profesor/').status_code == 200
    assert cliente.post(f'{INSCRIPCIONES}inscribir/',
                        {'estudiante_id': otro_estudiante.persona.id, 'materia_ids': [materia.id]},
                        format='json').status_code == 201
    assert cliente.post(f'{INSCRIPCIONES}desinscribir/',
                        {'estudiante_id': otro_estudiante.persona.id, 'materia_id': materia.id},
                        format='json').status_code == 200


# --- Lectura acotada por rol ---

def test_estudiante_sin_inscripcion_no_ve_materias_ajenas(api_as, otro_estudiante, materia_con_inscripcion):
    assert _ids(api_as(otro_estudiante).get(MATERIAS)) == set()
    assert api_as(otro_estudiante).get(f'{MATERIAS}{materia_con_inscripcion.id}/').status_code == 404


def test_estudiante_solo_ve_materias_con_inscripcion_activa(api_as, estudiante, materia_con_inscripcion, ajena):
    assert _ids(api_as(estudiante).get(MATERIAS)) == {materia_con_inscripcion.id}
    Inscripcion.objects.update(estado=Inscripcion.EstadoInscripcion.LIBRE)
    assert _ids(api_as(estudiante).get(MATERIAS)) == {materia_con_inscripcion.id}  # LIBRE sigue siendo parte
    Inscripcion.objects.update(estado=Inscripcion.EstadoInscripcion.BAJA)
    assert _ids(api_as(estudiante).get(MATERIAS)) == set()


def test_profesor_solo_ve_sus_materias(api_as, profesor, materia_con_inscripcion, ajena):
    assert _ids(api_as(profesor).get(MATERIAS)) == {materia_con_inscripcion.id}
    assert api_as(profesor).get(f'{MATERIAS}{ajena.id}/').status_code == 404


def test_administrador_ve_todas_las_materias(api_as, admin, materia_con_inscripcion, ajena):
    assert _ids(api_as(admin).get(MATERIAS)) == {materia_con_inscripcion.id, ajena.id}


def test_los_filtros_no_amplian_el_alcance(api_as, estudiante, materia_con_inscripcion, ajena):
    respuesta = api_as(estudiante).get(MATERIAS, {'profesor': ajena.profesor_id})
    assert _ids(respuesta) == set()


# --- IDOR: por-estudiante e inscripciones?estudiante= ---

def test_estudiante_solo_consulta_sus_propias_materias(api_as, estudiante, otro_estudiante,
                                                       materia_con_inscripcion):
    InscripcionFactory(materia=materia_con_inscripcion, estudiante=otro_estudiante.persona)
    cliente = api_as(estudiante)
    propias = cliente.get(f'{MATERIAS}por-estudiante/{estudiante.persona.id}/')
    assert propias.status_code == 200
    assert _ids(propias) == {materia_con_inscripcion.id}
    assert cliente.get(f'{MATERIAS}por-estudiante/{otro_estudiante.persona.id}/').status_code == 403


def test_por_estudiante_con_id_no_numerico_da_400(api_as, admin):
    assert api_as(admin).get(f'{MATERIAS}por-estudiante/abc/').status_code == 400


def test_profesor_ve_la_interseccion_con_sus_materias(api_as, profesor, estudiante, materia_con_inscripcion, ajena):
    InscripcionFactory(materia=ajena, estudiante=estudiante.persona)
    respuesta = api_as(profesor).get(f'{MATERIAS}por-estudiante/{estudiante.persona.id}/')
    assert _ids(respuesta) == {materia_con_inscripcion.id}


def test_administrador_consulta_cualquier_estudiante(api_as, admin, estudiante, materia_con_inscripcion, ajena):
    InscripcionFactory(materia=ajena, estudiante=estudiante.persona)
    respuesta = api_as(admin).get(f'{MATERIAS}por-estudiante/{estudiante.persona.id}/')
    assert _ids(respuesta) == {materia_con_inscripcion.id, ajena.id}


def test_estudiante_no_lee_inscripciones_ajenas(api_as, estudiante, otro_estudiante, materia_con_inscripcion):
    ajena = InscripcionFactory(materia=materia_con_inscripcion, estudiante=otro_estudiante.persona)
    cliente = api_as(estudiante)
    # Sin filtro solo ve la propia
    assert {i['estudiante'] for i in cliente.get(INSCRIPCIONES).json()} == {estudiante.persona.id}
    assert cliente.get(INSCRIPCIONES, {'estudiante': otro_estudiante.persona.id}).status_code == 403
    assert cliente.get(f'{INSCRIPCIONES}{ajena.id}/').status_code == 404
    assert cliente.get(INSCRIPCIONES, {'estudiante': estudiante.persona.id}).status_code == 200


def test_profesor_solo_lee_inscripciones_de_sus_materias(api_as, profesor, estudiante, materia_con_inscripcion, ajena):
    de_otro = InscripcionFactory(materia=ajena, estudiante=estudiante.persona)
    cliente = api_as(profesor)
    assert {i['materia'] for i in cliente.get(INSCRIPCIONES).json()} == {materia_con_inscripcion.id}
    assert cliente.get(f'{INSCRIPCIONES}{de_otro.id}/').status_code == 404


def test_administrador_lee_todas_las_inscripciones_y_las_bajas(api_as, admin, estudiante, materia_con_inscripcion,
                                                               ajena):
    InscripcionFactory(materia=ajena, estudiante=estudiante.persona, estado=Inscripcion.EstadoInscripcion.BAJA)
    assert len(api_as(admin).get(INSCRIPCIONES).json()) == 1
    assert len(api_as(admin).get(INSCRIPCIONES, {'incluir_baja': 'true'}).json()) == 2
    assert Materia.objects.count() == 2


def test_rendimiento_curso_de_materia_ajena_da_404(api_as, profesor, estudiante, otro_estudiante,
                                                   materia_con_inscripcion, ajena):
    assert api_as(profesor).get(f'{MATERIAS}{ajena.id}/rendimiento-curso/').status_code == 404
    assert api_as(otro_estudiante).get(
        f'{MATERIAS}{materia_con_inscripcion.id}/rendimiento-curso/').status_code == 404
