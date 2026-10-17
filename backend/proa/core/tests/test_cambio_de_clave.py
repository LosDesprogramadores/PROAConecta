import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from usuario.tests.factories import PASSWORD_PRUEBA, UsuarioFactory

CODIGO = 'cambio_de_clave_requerido'
CLAVE_NUEVA = 'Otra-clave-segura-456'


def cliente_con_token(usuario):
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(usuario).access_token}')
    return cliente


@pytest.fixture
def con_clave_provisoria(rol_estudiante):
    return UsuarioFactory(persona__rol=rol_estudiante, debe_cambiar_password=True)


@pytest.mark.django_db
@pytest.mark.parametrize('metodo, ruta', [
    ('get', '/api/materias/'),
    ('get', '/api/notificaciones/'),
    ('get', '/api/mensajes/'),
    ('post', '/api/ws/ticket/'),
])
def test_endpoint_autenticado_rechaza_con_clave_provisoria(con_clave_provisoria, metodo, ruta):
    respuesta = getattr(cliente_con_token(con_clave_provisoria), metodo)(ruta)

    assert respuesta.status_code == 403
    assert respuesta.data['code'] == CODIGO
    assert respuesta.data['detail']


@pytest.mark.django_db
def test_perfil_responde_con_clave_provisoria(con_clave_provisoria):
    respuesta = cliente_con_token(con_clave_provisoria).get('/api/auth/me/')

    assert respuesta.status_code == 200


@pytest.mark.django_db
def test_cambio_de_clave_responde_con_clave_provisoria(con_clave_provisoria):
    respuesta = cliente_con_token(con_clave_provisoria).post(
        '/api/auth/cambiar-password-primer-ingreso/',
        {'password_actual': PASSWORD_PRUEBA, 'password_nuevo': CLAVE_NUEVA},
        format='json',
    )

    assert respuesta.status_code == 200


@pytest.mark.django_db
def test_tras_cambiar_la_clave_los_endpoints_vuelven_a_responder(con_clave_provisoria):
    cliente = cliente_con_token(con_clave_provisoria)
    assert cliente.get('/api/materias/').status_code == 403

    cambio = cliente.post(
        '/api/auth/cambiar-password-primer-ingreso/',
        {'password_actual': PASSWORD_PRUEBA, 'password_nuevo': CLAVE_NUEVA},
        format='json',
    )
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {cambio.data['access']}")

    assert cliente.get('/api/materias/').status_code == 200


@pytest.mark.django_db
def test_se_lee_el_valor_de_la_base_y_no_el_del_token(con_clave_provisoria):
    cliente = cliente_con_token(con_clave_provisoria)
    con_clave_provisoria.debe_cambiar_password = False
    con_clave_provisoria.save(update_fields=['debe_cambiar_password'])

    assert cliente.get('/api/materias/').status_code == 200


@pytest.mark.django_db
def test_usuario_sin_clave_provisoria_no_se_ve_afectado(estudiante):
    assert cliente_con_token(estudiante).get('/api/materias/').status_code == 200


@pytest.mark.django_db
def test_endpoints_publicos_no_cambian_con_clave_provisoria(con_clave_provisoria):
    cliente = cliente_con_token(con_clave_provisoria)
    refresh = RefreshToken.for_user(con_clave_provisoria)

    login = APIClient().post(
        '/api/auth/login/', {'dni': con_clave_provisoria.persona.dni, 'password': PASSWORD_PRUEBA}, format='json',
    )
    logout = cliente.post('/api/auth/logout/', {'refresh': str(refresh)}, format='json')
    recuperacion = cliente.post('/api/auth/solicitar-recuperacion/', {'email': 'nadie@ejemplo.test'}, format='json')

    assert login.status_code == 200
    assert login.data['debe_cambiar_password'] is True
    assert logout.status_code == 204
    assert recuperacion.status_code == 200
