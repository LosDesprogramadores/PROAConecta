import pytest

from usuario.tests.factories import PASSWORD_PRUEBA


@pytest.mark.django_db
def test_login_con_dni_devuelve_tokens(cliente_anonimo, estudiante):
    respuesta = cliente_anonimo.post(
        '/api/auth/login/',
        {'dni': estudiante.persona.dni, 'password': PASSWORD_PRUEBA},
        format='json',
    )

    assert respuesta.status_code == 200
    assert respuesta.data['access']
    assert respuesta.data['refresh']


@pytest.mark.django_db
def test_login_con_password_incorrecta_devuelve_400(cliente_anonimo, estudiante):
    respuesta = cliente_anonimo.post(
        '/api/auth/login/',
        {'dni': estudiante.persona.dni, 'password': 'incorrecta'},
        format='json',
    )

    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_me_con_token_devuelve_la_persona(cliente_anonimo, estudiante):
    login = cliente_anonimo.post(
        '/api/auth/login/',
        {'dni': estudiante.persona.dni, 'password': PASSWORD_PRUEBA},
        format='json',
    )
    cliente_anonimo.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["access"]}')

    respuesta = cliente_anonimo.get('/api/auth/me/')

    assert respuesta.status_code == 200
    assert respuesta.data['persona']['dni'] == estudiante.persona.dni
    assert respuesta.data['rolNombre'] == 'Estudiante'
