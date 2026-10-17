import pytest

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from usuario.tests.factories import PersonaFactory, UsuarioFactory

CLAVES_CONTRATO = {
    'inscripcion_id', 'persona_id', 'apellido', 'nombre', 'email', 'estado', 'fecha_inscripcion',
}
CAMPOS_PROHIBIDOS = {'dni', 'tel_contacto', 'fecha_nacimiento', 'domicilio'}


def url(materia):
    return f'/api/materias/{materia.id}/alumnos/'


@pytest.fixture
def estudiantes_inscriptos(materia_con_inscripcion, rol_estudiante):
    # El fixture materia_con_inscripcion ya inscribe a un estudiante; se suman dos más
    extra = [
        InscripcionFactory(
            materia=materia_con_inscripcion,
            estudiante=PersonaFactory(rol=rol_estudiante, apellido=apellido, nombre='Ana'),
        )
        for apellido in ('Zeta', 'Alfa')
    ]
    return extra


@pytest.mark.django_db
def test_profesor_titular_ve_exactamente_los_alumnos_inscriptos(
    api_as, profesor, materia_con_inscripcion, estudiantes_inscriptos
):
    respuesta = api_as(profesor).get(url(materia_con_inscripcion))

    assert respuesta.status_code == 200
    esperados = set(
        Inscripcion.objects.filter(materia=materia_con_inscripcion).values_list('estudiante_id', flat=True)
    )
    assert {fila['persona_id'] for fila in respuesta.json()} == esperados
    assert len(respuesta.json()) == 3


@pytest.mark.django_db
def test_cada_fila_trae_solo_las_claves_del_contrato(api_as, profesor, materia_con_inscripcion):
    respuesta = api_as(profesor).get(url(materia_con_inscripcion))

    for fila in respuesta.json():
        assert set(fila) == CLAVES_CONTRATO
        assert not CAMPOS_PROHIBIDOS & set(fila)


@pytest.mark.django_db
def test_la_respuesta_no_esta_paginada_y_se_ordena_por_apellido(
    api_as, profesor, materia_con_inscripcion, estudiantes_inscriptos
):
    respuesta = api_as(profesor).get(url(materia_con_inscripcion))

    assert isinstance(respuesta.json(), list)
    apellidos = [fila['apellido'] for fila in respuesta.json()]
    assert apellidos == sorted(apellidos)


@pytest.mark.django_db
def test_los_alumnos_de_otra_materia_no_aparecen(api_as, profesor, materia_con_inscripcion):
    otra = MateriaFactory(profesor=profesor.persona, curso='2do B')
    ajeno = InscripcionFactory(materia=otra)

    respuesta = api_as(profesor).get(url(materia_con_inscripcion))

    assert ajeno.estudiante_id not in {fila['persona_id'] for fila in respuesta.json()}


@pytest.mark.django_db
def test_por_defecto_se_excluye_la_baja(api_as, profesor, materia_con_inscripcion, estudiantes_inscriptos):
    dada_de_baja = estudiantes_inscriptos[0]
    dada_de_baja.estado = Inscripcion.EstadoInscripcion.BAJA
    dada_de_baja.save()

    respuesta = api_as(profesor).get(url(materia_con_inscripcion))

    ids = {fila['inscripcion_id'] for fila in respuesta.json()}
    assert dada_de_baja.id not in ids
    assert len(ids) == 2


@pytest.mark.django_db
def test_filtro_estado_baja_trae_solo_las_bajas(api_as, profesor, materia_con_inscripcion, estudiantes_inscriptos):
    dada_de_baja = estudiantes_inscriptos[0]
    dada_de_baja.estado = Inscripcion.EstadoInscripcion.BAJA
    dada_de_baja.save()

    respuesta = api_as(profesor).get(url(materia_con_inscripcion), {'estado': 'BAJA'})

    assert [fila['inscripcion_id'] for fila in respuesta.json()] == [dada_de_baja.id]


@pytest.mark.django_db
def test_filtro_estado_acepta_los_estados_del_modelo(api_as, profesor, materia_con_inscripcion, estudiantes_inscriptos):
    regular = estudiantes_inscriptos[0]
    regular.estado = Inscripcion.EstadoInscripcion.REGULAR
    regular.save()

    respuesta = api_as(profesor).get(url(materia_con_inscripcion), {'estado': 'REGULAR'})

    assert [fila['inscripcion_id'] for fila in respuesta.json()] == [regular.id]


@pytest.mark.django_db
def test_filtro_estado_invalido_devuelve_400(api_as, profesor, materia_con_inscripcion):
    respuesta = api_as(profesor).get(url(materia_con_inscripcion), {'estado': 'ACTIVA'})

    assert respuesta.status_code == 400
    assert 'estado' in respuesta.json()


@pytest.mark.django_db
def test_search_filtra_por_apellido_o_nombre(api_as, profesor, materia_con_inscripcion, estudiantes_inscriptos):
    por_apellido = api_as(profesor).get(url(materia_con_inscripcion), {'search': 'zet'})
    por_nombre = api_as(profesor).get(url(materia_con_inscripcion), {'search': 'ana'})

    assert [fila['apellido'] for fila in por_apellido.json()] == ['Zeta']
    assert len(por_nombre.json()) == 2


@pytest.mark.django_db
def test_administrador_ve_el_listado(api_as, admin, materia_con_inscripcion):
    respuesta = api_as(admin).get(url(materia_con_inscripcion))

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 1


@pytest.mark.django_db
def test_profesor_ajeno_recibe_403(api_as, rol_profesor, materia_con_inscripcion):
    ajeno = UsuarioFactory(persona__rol=rol_profesor)

    respuesta = api_as(ajeno).get(url(materia_con_inscripcion))

    assert respuesta.status_code == 403


@pytest.mark.django_db
def test_estudiante_inscripto_recibe_403(api_as, estudiante, materia_con_inscripcion):
    respuesta = api_as(estudiante).get(url(materia_con_inscripcion))

    assert respuesta.status_code == 403


@pytest.mark.django_db
def test_anonimo_recibe_401(cliente_anonimo, materia_con_inscripcion):
    respuesta = cliente_anonimo.get(url(materia_con_inscripcion))

    assert respuesta.status_code == 401


@pytest.mark.django_db
def test_materia_inexistente_devuelve_404(api_as, profesor):
    respuesta = api_as(profesor).get('/api/materias/999999/alumnos/')

    assert respuesta.status_code == 404


@pytest.mark.django_db
def test_materia_sin_profesor_solo_la_ve_el_administrador(api_as, profesor, admin):
    sin_titular = MateriaFactory(profesor=None)

    assert api_as(profesor).get(url(sin_titular)).status_code == 403
    assert api_as(admin).get(url(sin_titular)).status_code == 200


@pytest.mark.django_db
def test_consultas_acotadas_e_independientes_de_la_cantidad_de_alumnos(
    api_as, profesor, materia_con_inscripcion, rol_estudiante, django_assert_max_num_queries
):
    cliente = api_as(profesor)
    for _ in range(10):
        InscripcionFactory(materia=materia_con_inscripcion, estudiante=PersonaFactory(rol=rol_estudiante))

    with django_assert_max_num_queries(3):
        respuesta = cliente.get(url(materia_con_inscripcion))

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 11
