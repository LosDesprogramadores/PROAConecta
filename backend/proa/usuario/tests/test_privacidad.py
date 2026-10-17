import pytest

from usuario.tests.factories import UsuarioFactory

pytestmark = pytest.mark.django_db

PERSONAS = '/api/personas/'
MATERIAS = '/api/materias/'
INSCRIPCIONES = '/api/inscripciones/'

CLAVES_PUBLICAS = {'id', 'nombre', 'apellido', 'rol'}
CLAVES_PRIVADAS = {'dni', 'email', 'tel_contacto', 'fecha_nacimiento'}
# Dirección de ejemplo, no corresponde a ningún webhook real
WEBHOOK = 'https://discord.com/api/webhooks/0/ejemplo-de-prueba'


@pytest.fixture
def ajeno(rol_estudiante):
    return UsuarioFactory(persona__rol=rol_estudiante)


def _por_id(respuesta):
    return {p['id']: p for p in respuesta.json()}


@pytest.mark.parametrize('rol', ['estudiante', 'profesor'])
def test_no_admin_ve_solo_claves_publicas_de_otros(api_as, rol, request, ajeno):
    usuario = request.getfixturevalue(rol)
    lista = _por_id(api_as(usuario).get(PERSONAS))
    ajena = lista[ajeno.persona.id]
    assert set(ajena) == CLAVES_PUBLICAS
    detalle = api_as(usuario).get(f'{PERSONAS}{ajeno.persona.id}/').json()
    assert set(detalle) == CLAVES_PUBLICAS


def test_cada_uno_ve_sus_propios_datos_completos(api_as, estudiante):
    propia = api_as(estudiante).get(f'{PERSONAS}{estudiante.persona.id}/').json()
    assert CLAVES_PRIVADAS <= set(propia)
    assert propia['dni'] == estudiante.persona.dni


def test_administrador_ve_los_datos_completos(api_as, admin, ajeno):
    ajena = _por_id(api_as(admin).get(PERSONAS))[ajeno.persona.id]
    assert CLAVES_PRIVADAS <= set(ajena)
    assert ajena['email'] == ajeno.persona.email


def test_personas_por_rol_no_filtra_datos_a_no_admin(api_as, estudiante, ajeno):
    respuesta = api_as(estudiante).get('/api/personas/rol/', {'rol': ajeno.persona.rol_id})
    assert respuesta.status_code == 200
    for persona in respuesta.json():
        if persona['id'] != estudiante.persona.id:
            assert set(persona) == CLAVES_PUBLICAS


def test_materia_no_expone_webhook_a_estudiante_ni_profesor(api_as, estudiante, profesor, materia_con_inscripcion):
    materia_con_inscripcion.discord_webhook_url = WEBHOOK
    materia_con_inscripcion.save()
    for usuario in (estudiante, profesor):
        for materia in api_as(usuario).get(MATERIAS).json():
            assert 'discord_webhook_url' not in materia
        assert 'discord_webhook_url' not in api_as(usuario).get(
            f'{MATERIAS}{materia_con_inscripcion.id}/').json()


def test_administrador_puede_guardar_y_leer_el_webhook(api_as, admin):
    cliente = api_as(admin)
    creada = cliente.post(MATERIAS, {'titulo': 'M', 'anio': 2026, 'curso': '1ro A',
                                     'discord_webhook_url': WEBHOOK}, format='json')
    assert creada.status_code == 201
    assert cliente.get(f'{MATERIAS}{creada.json()["id"]}/').json()['discord_webhook_url'] == WEBHOOK


def test_profesor_de_la_materia_no_ve_datos_privados_del_estudiante_en_inscripciones(
        api_as, profesor, estudiante, materia_con_inscripcion):
    inscripcion = api_as(profesor).get(INSCRIPCIONES).json()[0]
    assert set(inscripcion['estudiante_detalle']) == {'id', 'nombre', 'apellido', 'nombre_completo', 'rol_nombre'}


def test_estudiante_no_ve_dni_ni_email_del_profesor_en_la_materia(api_as, estudiante, profesor,
                                                                  materia_con_inscripcion):
    detalle = api_as(estudiante).get(MATERIAS).json()[0]['profesor_detalle']
    assert 'dni' not in detalle and 'email' not in detalle
    assert detalle['nombre_completo']


def test_administrador_conserva_el_detalle_completo_en_materias(api_as, admin, profesor, materia_con_inscripcion):
    detalle = api_as(admin).get(MATERIAS).json()[0]['profesor_detalle']
    assert detalle['dni'] == profesor.persona.dni and detalle['email'] == profesor.persona.email


def test_roster_del_profesor_sigue_mostrando_lo_que_usa_la_pantalla(api_as, profesor, estudiante,
                                                                     materia_con_inscripcion):
    alumnos = api_as(profesor).get(f'{MATERIAS}{materia_con_inscripcion.id}/alumnos/').json()
    assert {'apellido', 'nombre', 'email', 'estado'} <= set(alumnos[0])
    assert 'dni' not in alumnos[0]


def test_snapshot_de_claves_de_inscripciones_para_admin(api_as, admin, materia_con_inscripcion):
    inscripcion = api_as(admin).get(INSCRIPCIONES).json()[0]
    assert set(inscripcion['estudiante_detalle']) == {
        'id', 'dni', 'nombre', 'apellido', 'nombre_completo', 'email', 'rol_nombre',
    }
