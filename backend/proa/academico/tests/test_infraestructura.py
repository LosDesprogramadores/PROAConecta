import pytest

from academico.models import Inscripcion
from aula_virtual.helpers import es_admin
from usuario.tests.factories import UsuarioFactory


@pytest.mark.django_db
def test_materia_con_inscripcion_es_consistente(materia_con_inscripcion, profesor, estudiante):
    materia = materia_con_inscripcion

    assert materia.profesor == profesor.persona
    inscripcion = Inscripcion.objects.get(materia=materia)
    assert inscripcion.estudiante == estudiante.persona
    assert inscripcion.estado == Inscripcion.EstadoInscripcion.CURSANDO


@pytest.mark.django_db
def test_estudiante_inscripto_ve_su_materia_en_el_listado(api_as, estudiante, materia_con_inscripcion):
    respuesta = api_as(estudiante).get('/api/materias/')

    # El listado no está paginado: la respuesta es una lista simple
    assert respuesta.status_code == 200
    assert materia_con_inscripcion.id in [m['id'] for m in respuesta.data]


@pytest.mark.django_db
def test_estudiante_sin_inscripcion_no_ve_materias_ajenas(api_as, rol_estudiante, materia_con_inscripcion):
    ajeno = UsuarioFactory(persona__rol=rol_estudiante)

    respuesta = api_as(ajeno).get('/api/materias/')

    # La lectura está acotada por rol: un estudiante solo ve materias con inscripción activa
    assert materia_con_inscripcion.id not in [m['id'] for m in respuesta.data]


@pytest.mark.django_db
def test_admin_es_reconocido_solo_por_nombre_de_rol(admin):
    # es_admin resuelve el rol por nombre (core/roles.py), no por id
    assert not admin.is_staff and not admin.is_superuser
    assert es_admin(admin)


@pytest.mark.django_db
def test_anonimo_no_puede_listar_materias(cliente_anonimo):
    respuesta = cliente_anonimo.get('/api/materias/')

    assert respuesta.status_code == 401


def test_mongo_mock_guarda_y_lee_documentos(mongo_mock):
    mongo_mock['notificacion'].insert_one({'titulo': 'Aviso', 'alcance': 'TODOS'})

    assert mongo_mock['notificacion'].count_documents({'alcance': 'TODOS'}) == 1
