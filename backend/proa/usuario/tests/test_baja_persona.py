import pytest

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from usuario.models import Persona
from usuario.tests.factories import PASSWORD_PRUEBA, PersonaFactory, UsuarioFactory


def url(persona):
    return f'/api/personas/{persona.id}/'


def baja(api_as, actor, persona):
    return api_as(actor).delete(url(persona))


@pytest.mark.django_db
def test_baja_de_profesor_sin_materias_responde_200_y_marca_fecha_baja(api_as, admin, profesor):
    # Regresión del 500 (UnboundLocalError en tiene_inscripciones) reportado desde el panel
    respuesta = baja(api_as, admin, profesor.persona)

    assert respuesta.status_code == 200
    assert respuesta.data['detail'].startswith('Profesor ')
    profesor.persona.refresh_from_db()
    assert profesor.persona.fecha_baja is not None


@pytest.mark.django_db
def test_baja_de_profesor_con_materias_sigue_respondiendo_400_con_su_mensaje(api_as, admin, profesor):
    MateriaFactory(profesor=profesor.persona)

    respuesta = baja(api_as, admin, profesor.persona)

    assert respuesta.status_code == 400
    assert respuesta.data['detail'] == 'No se puede eliminar un profesor con materias asignadas.'
    profesor.persona.refresh_from_db()
    assert profesor.persona.fecha_baja is None


@pytest.mark.django_db
def test_baja_de_estudiante_sin_inscripciones_responde_200(api_as, admin, estudiante):
    respuesta = baja(api_as, admin, estudiante.persona)

    assert respuesta.status_code == 200
    assert respuesta.data['detail'].startswith('Estudiante ')
    estudiante.persona.refresh_from_db()
    assert estudiante.persona.fecha_baja is not None


@pytest.mark.django_db
@pytest.mark.parametrize('estado', ['CURSANDO', 'REGULAR', 'PROMOCIONADO', 'LIBRE'])
def test_baja_de_estudiante_con_inscripcion_que_no_es_baja_responde_400(api_as, admin, estudiante, estado):
    # LIBRE sigue siendo parte de la materia: solo BAJA libera al estudiante
    InscripcionFactory(estudiante=estudiante.persona, estado=estado)

    respuesta = baja(api_as, admin, estudiante.persona)

    assert respuesta.status_code == 400
    assert respuesta.data['detail'] == 'No se puede eliminar un estudiante que tiene materias o inscripciones activas.'
    estudiante.persona.refresh_from_db()
    assert estudiante.persona.fecha_baja is None


@pytest.mark.django_db
def test_baja_de_estudiante_con_todas_sus_inscripciones_en_baja_responde_200(api_as, admin, estudiante):
    InscripcionFactory(estudiante=estudiante.persona, estado=Inscripcion.EstadoInscripcion.BAJA)

    respuesta = baja(api_as, admin, estudiante.persona)

    assert respuesta.status_code == 200


@pytest.mark.django_db
def test_baja_de_persona_sin_rol_responde_200(api_as, admin):
    sin_rol = PersonaFactory(rol=None)

    respuesta = baja(api_as, admin, sin_rol)

    assert respuesta.status_code == 200
    assert respuesta.data['detail'] == 'Registro eliminado correctamente.'
    sin_rol.refresh_from_db()
    assert sin_rol.fecha_baja is not None


@pytest.mark.django_db
def test_baja_de_un_administrador_que_no_es_el_ultimo_responde_200(api_as, admin, rol_administrador):
    otro_admin = UsuarioFactory(persona__rol=rol_administrador)

    respuesta = baja(api_as, admin, otro_admin.persona)

    assert respuesta.status_code == 200
    otro_admin.persona.refresh_from_db()
    assert otro_admin.persona.fecha_baja is not None


@pytest.mark.django_db
def test_no_se_puede_dar_de_baja_la_propia_cuenta(api_as, admin, rol_administrador):
    UsuarioFactory(persona__rol=rol_administrador)  # hay otro administrador: el bloqueo es por ser la propia cuenta

    respuesta = baja(api_as, admin, admin.persona)

    assert respuesta.status_code == 400
    assert respuesta.data['detail'] == 'No se puede eliminar tu propia cuenta.'
    admin.persona.refresh_from_db()
    assert admin.persona.fecha_baja is None


@pytest.mark.django_db
def test_no_se_puede_dar_de_baja_al_ultimo_administrador_activo(api_as, admin):
    # Un superusuario sin rol de administrador es otra cuenta distinta del único administrador
    superusuario = UsuarioFactory(persona__rol=None, is_superuser=True)

    respuesta = baja(api_as, superusuario, admin.persona)

    assert respuesta.status_code == 400
    assert respuesta.data['detail'] == 'No se puede eliminar al último administrador activo.'
    admin.persona.refresh_from_db()
    assert admin.persona.fecha_baja is None


@pytest.mark.django_db
def test_un_administrador_dado_de_baja_o_inactivo_no_cuenta_como_activo(api_as, admin, rol_administrador):
    inactivo = UsuarioFactory(persona__rol=rol_administrador, activo=False)
    de_baja = UsuarioFactory(persona__rol=rol_administrador)
    de_baja.persona.soft_delete()
    superusuario = UsuarioFactory(persona__rol=None, is_superuser=True)

    respuesta = baja(api_as, superusuario, admin.persona)

    assert respuesta.status_code == 400
    assert respuesta.data['detail'] == 'No se puede eliminar al último administrador activo.'
    inactivo.persona.refresh_from_db()
    assert inactivo.persona.fecha_baja is None


@pytest.mark.django_db
def test_la_baja_es_logica_y_no_borra_la_fila(api_as, admin, profesor):
    baja(api_as, admin, profesor.persona)

    assert Persona.objects.filter(pk=profesor.persona.pk).exists()


@pytest.mark.django_db
def test_dar_de_baja_a_una_persona_ya_dada_de_baja_responde_404(api_as, admin, profesor):
    profesor.persona.soft_delete()

    respuesta = baja(api_as, admin, profesor.persona)

    assert respuesta.status_code == 404


@pytest.mark.django_db
def test_una_persona_dada_de_baja_no_puede_iniciar_sesion(cliente_anonimo, api_as, admin, estudiante):
    antes = cliente_anonimo.post(
        '/api/auth/login/', {'dni': estudiante.persona.dni, 'password': PASSWORD_PRUEBA}, format='json'
    )
    assert antes.status_code == 200

    assert baja(api_as, admin, estudiante.persona).status_code == 200

    despues = cliente_anonimo.post(
        '/api/auth/login/', {'dni': estudiante.persona.dni, 'password': PASSWORD_PRUEBA}, format='json'
    )
    assert despues.status_code == 400
