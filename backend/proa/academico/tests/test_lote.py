import pytest

from academico.models import Inscripcion, Materia
from academico.tests.factories import MateriaFactory
from usuario.tests.factories import PersonaFactory

ASIGNAR = '/api/materias/asignar-profesor/'
INSCRIBIR = '/api/inscripciones/inscribir/'
DESINSCRIBIR = '/api/inscripciones/desinscribir/'
ID_INEXISTENTE = 999999


@pytest.fixture
def materias():
    return [MateriaFactory(curso=f'{n}ro A') for n in range(1, 4)]


def ids(materias):
    return [m.id for m in materias]


# --- asignar-profesor ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_asignar_profesor_valido_actualiza_las_materias(api_as, admin, profesor, materias):
    respuesta = api_as(admin).post(ASIGNAR, {'profesor_id': profesor.persona.id, 'materia_ids': ids(materias[:2])}, format='json')

    assert respuesta.status_code == 200
    assert respuesta.data['mensaje'] == 'Se asignó el profesor a 2 materias correctamente.'
    assert respuesta.data['profesor_id'] == profesor.persona.id
    assert Materia.objects.filter(profesor=profesor.persona).count() == 2
    assert Materia.objects.get(pk=materias[2].pk).profesor is None


@pytest.mark.django_db
def test_asignar_profesor_inexistente_devuelve_400_por_campo(api_as, admin, materias):
    respuesta = api_as(admin).post(ASIGNAR, {'profesor_id': ID_INEXISTENTE, 'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 400
    assert 'profesor_id' in respuesta.data
    assert Materia.objects.filter(profesor__isnull=False).count() == 0


@pytest.mark.django_db
def test_asignar_profesor_con_id_no_numerico_devuelve_400_y_no_500(api_as, admin, materias):
    respuesta = api_as(admin).post(ASIGNAR, {'profesor_id': 'abc', 'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 400
    assert 'profesor_id' in respuesta.data


@pytest.mark.django_db
def test_asignar_sin_profesor_devuelve_400_por_campo(api_as, admin, materias):
    respuesta = api_as(admin).post(ASIGNAR, {'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 400
    assert 'profesor_id' in respuesta.data


@pytest.mark.django_db
def test_asignar_una_persona_que_no_es_profesor_devuelve_400(api_as, admin, estudiante, materias):
    respuesta = api_as(admin).post(ASIGNAR, {'profesor_id': estudiante.persona.id, 'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 400
    assert 'profesor_id' in respuesta.data
    assert Materia.objects.filter(profesor__isnull=False).count() == 0


@pytest.mark.django_db
def test_asignar_un_profesor_dado_de_baja_devuelve_400(api_as, admin, profesor, materias):
    profesor.persona.soft_delete()

    respuesta = api_as(admin).post(ASIGNAR, {'profesor_id': profesor.persona.id, 'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 400
    assert 'profesor_id' in respuesta.data


@pytest.mark.django_db
@pytest.mark.parametrize('materia_ids', [[], 'no-es-lista', None])
def test_asignar_con_materia_ids_vacio_o_que_no_es_lista_devuelve_400(api_as, admin, profesor, materia_ids):
    respuesta = api_as(admin).post(ASIGNAR, {'profesor_id': profesor.persona.id, 'materia_ids': materia_ids}, format='json')

    assert respuesta.status_code == 400
    assert 'materia_ids' in respuesta.data


@pytest.mark.django_db
def test_asignar_con_una_materia_inexistente_devuelve_400_y_no_asigna_ninguna(api_as, admin, profesor, materias):
    respuesta = api_as(admin).post(
        ASIGNAR, {'profesor_id': profesor.persona.id, 'materia_ids': [*ids(materias), ID_INEXISTENTE]}, format='json'
    )

    assert respuesta.status_code == 400
    assert str(ID_INEXISTENTE) in str(respuesta.data['materia_ids'])
    assert Materia.objects.filter(profesor__isnull=False).count() == 0


@pytest.mark.django_db
def test_asignar_con_materias_repetidas_devuelve_400(api_as, admin, profesor, materias):
    respuesta = api_as(admin).post(
        ASIGNAR, {'profesor_id': profesor.persona.id, 'materia_ids': [materias[0].id, materias[0].id]}, format='json'
    )

    assert respuesta.status_code == 400
    assert 'materia_ids' in respuesta.data


@pytest.mark.django_db
def test_asignar_con_ids_de_materia_que_no_son_enteros_devuelve_400(api_as, admin, profesor):
    respuesta = api_as(admin).post(ASIGNAR, {'profesor_id': profesor.persona.id, 'materia_ids': ['x', 1.5]}, format='json')

    assert respuesta.status_code == 400
    assert 'materia_ids' in respuesta.data


# --- inscribir en lote -------------------------------------------------------------------------

@pytest.mark.django_db
def test_inscribir_lote_valido_crea_las_inscripciones(api_as, admin, estudiante, materias):
    respuesta = api_as(admin).post(INSCRIBIR, {'estudiante_id': estudiante.persona.id, 'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 201
    assert respuesta.data['cantidad'] == 3
    assert respuesta.data['estudiante_id'] == estudiante.persona.id
    assert Inscripcion.objects.filter(estudiante=estudiante.persona).count() == 3


@pytest.mark.django_db
def test_inscribir_lote_con_una_materia_ya_inscripta_no_la_cuenta(api_as, admin, estudiante, materias):
    Inscripcion.objects.create(estudiante=estudiante.persona, materia=materias[0])

    respuesta = api_as(admin).post(INSCRIBIR, {'estudiante_id': estudiante.persona.id, 'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 201
    assert respuesta.data['cantidad'] == 2
    assert Inscripcion.objects.filter(estudiante=estudiante.persona).count() == 3


@pytest.mark.django_db
def test_inscribir_estudiante_inexistente_devuelve_400_y_no_500(api_as, admin, materias):
    respuesta = api_as(admin).post(INSCRIBIR, {'estudiante_id': ID_INEXISTENTE, 'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 400
    assert 'estudiante_id' in respuesta.data


@pytest.mark.django_db
def test_inscribir_con_estudiante_id_no_numerico_devuelve_400(api_as, admin, materias):
    respuesta = api_as(admin).post(INSCRIBIR, {'estudiante_id': 'abc', 'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 400
    assert 'estudiante_id' in respuesta.data


@pytest.mark.django_db
def test_inscribir_sin_estudiante_devuelve_400_por_campo(api_as, admin, materias):
    respuesta = api_as(admin).post(INSCRIBIR, {'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 400
    assert 'estudiante_id' in respuesta.data


@pytest.mark.django_db
def test_inscribir_a_una_persona_que_no_es_estudiante_devuelve_400(api_as, admin, profesor, materias):
    respuesta = api_as(admin).post(INSCRIBIR, {'estudiante_id': profesor.persona.id, 'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 400
    assert 'estudiante_id' in respuesta.data
    assert Inscripcion.objects.count() == 0


@pytest.mark.django_db
def test_inscribir_a_una_persona_sin_rol_devuelve_400(api_as, admin, materias):
    sin_rol = PersonaFactory(rol=None)

    respuesta = api_as(admin).post(INSCRIBIR, {'estudiante_id': sin_rol.id, 'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 400
    assert 'estudiante_id' in respuesta.data


@pytest.mark.django_db
def test_inscribir_a_un_estudiante_dado_de_baja_devuelve_400(api_as, admin, estudiante, materias):
    estudiante.persona.soft_delete()

    respuesta = api_as(admin).post(INSCRIBIR, {'estudiante_id': estudiante.persona.id, 'materia_ids': ids(materias)}, format='json')

    assert respuesta.status_code == 400
    assert 'estudiante_id' in respuesta.data


@pytest.mark.django_db
def test_inscribir_con_una_materia_inexistente_devuelve_400_y_no_inscribe_en_ninguna(api_as, admin, estudiante, materias):
    respuesta = api_as(admin).post(
        INSCRIBIR, {'estudiante_id': estudiante.persona.id, 'materia_ids': [*ids(materias), ID_INEXISTENTE]}, format='json'
    )

    assert respuesta.status_code == 400
    assert str(ID_INEXISTENTE) in str(respuesta.data['materia_ids'])
    assert Inscripcion.objects.count() == 0


@pytest.mark.django_db
def test_inscribir_con_materias_repetidas_devuelve_400(api_as, admin, estudiante, materias):
    respuesta = api_as(admin).post(
        INSCRIBIR, {'estudiante_id': estudiante.persona.id, 'materia_ids': [materias[0].id, materias[0].id]}, format='json'
    )

    assert respuesta.status_code == 400
    assert 'materia_ids' in respuesta.data
    assert Inscripcion.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize('materia_ids', [[], 'no-es-lista', None])
def test_inscribir_con_materia_ids_vacio_o_que_no_es_lista_devuelve_400(api_as, admin, estudiante, materia_ids):
    respuesta = api_as(admin).post(INSCRIBIR, {'estudiante_id': estudiante.persona.id, 'materia_ids': materia_ids}, format='json')

    assert respuesta.status_code == 400
    assert 'materia_ids' in respuesta.data


# --- desinscribir ------------------------------------------------------------------------------

@pytest.mark.django_db
def test_desinscribir_con_estudiante_o_materia_inexistente_devuelve_400_por_campo(api_as, admin, estudiante, materias):
    respuesta = api_as(admin).post(DESINSCRIBIR, {'estudiante_id': ID_INEXISTENTE, 'materia_id': ID_INEXISTENTE}, format='json')

    assert respuesta.status_code == 400
    assert 'estudiante_id' in respuesta.data and 'materia_id' in respuesta.data


@pytest.mark.django_db
def test_desinscribir_sin_materia_devuelve_400_por_campo(api_as, admin, estudiante):
    respuesta = api_as(admin).post(DESINSCRIBIR, {'estudiante_id': estudiante.persona.id}, format='json')

    assert respuesta.status_code == 400
    assert 'materia_id' in respuesta.data


@pytest.mark.django_db
def test_desinscribir_sin_inscripcion_sigue_devolviendo_404(api_as, admin, estudiante, materias):
    respuesta = api_as(admin).post(
        DESINSCRIBIR, {'estudiante_id': estudiante.persona.id, 'materia_id': materias[0].id}, format='json'
    )

    assert respuesta.status_code == 404
    assert 'detail' in respuesta.data
