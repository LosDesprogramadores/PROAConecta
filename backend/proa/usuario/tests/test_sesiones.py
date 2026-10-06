import pytest
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from usuario.services import revocar_sesiones
from usuario.tests.factories import PASSWORD_PRUEBA, UsuarioFactory


def iniciar_sesion(cliente, usuario):
    respuesta = cliente.post(
        '/api/auth/login/',
        {'dni': usuario.persona.dni, 'password': PASSWORD_PRUEBA},
        format='json',
    )
    assert respuesta.status_code == 200
    return respuesta.data


def refrescar(cliente, refresh):
    return cliente.post('/api/auth/refresh/', {'refresh': refresh}, format='json')


# --- logout ---

@pytest.mark.django_db
def test_logout_deja_el_refresh_en_la_blacklist(cliente_anonimo, estudiante):
    tokens = iniciar_sesion(cliente_anonimo, estudiante)

    respuesta = cliente_anonimo.post('/api/auth/logout/', {'refresh': tokens['refresh']}, format='json')

    assert respuesta.status_code == 204
    assert refrescar(cliente_anonimo, tokens['refresh']).status_code == 401


@pytest.mark.django_db
def test_logout_funciona_con_el_access_vencido_o_invalido(cliente_anonimo, estudiante):
    tokens = iniciar_sesion(cliente_anonimo, estudiante)
    cliente_anonimo.credentials(HTTP_AUTHORIZATION='Bearer access.vencido.invalido')

    respuesta = cliente_anonimo.post('/api/auth/logout/', {'refresh': tokens['refresh']}, format='json')

    assert respuesta.status_code == 204
    assert refrescar(cliente_anonimo, tokens['refresh']).status_code == 401


@pytest.mark.django_db
def test_logout_es_idempotente(cliente_anonimo, estudiante):
    tokens = iniciar_sesion(cliente_anonimo, estudiante)

    primera = cliente_anonimo.post('/api/auth/logout/', {'refresh': tokens['refresh']}, format='json')
    segunda = cliente_anonimo.post('/api/auth/logout/', {'refresh': tokens['refresh']}, format='json')

    assert primera.status_code == 204
    assert segunda.status_code == 204


@pytest.mark.django_db
@pytest.mark.parametrize('cuerpo', [{}, {'refresh': ''}, {'refresh': 'no-es-un-token'}])
def test_logout_con_refresh_ausente_o_invalido_responde_400(cliente_anonimo, cuerpo):
    respuesta = cliente_anonimo.post('/api/auth/logout/', cuerpo, format='json')

    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_logout_rechaza_un_access_token_en_lugar_del_refresh(cliente_anonimo, estudiante):
    tokens = iniciar_sesion(cliente_anonimo, estudiante)

    respuesta = cliente_anonimo.post('/api/auth/logout/', {'refresh': tokens['access']}, format='json')

    assert respuesta.status_code == 400


# --- revocación por cambio de clave ---

@pytest.mark.django_db
def test_cambiar_password_revoca_los_refresh_anteriores(cliente_anonimo, estudiante):
    tokens = iniciar_sesion(cliente_anonimo, estudiante)
    otra_sesion = iniciar_sesion(cliente_anonimo, estudiante)
    cliente_anonimo.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')

    respuesta = cliente_anonimo.post(
        '/api/auth/cambiar-password-primer-ingreso/',
        {'password_actual': PASSWORD_PRUEBA, 'password_nuevo': 'Otra-clave-456'},
        format='json',
    )

    assert respuesta.status_code == 200
    cliente_anonimo.credentials()
    assert refrescar(cliente_anonimo, tokens['refresh']).status_code == 401
    assert refrescar(cliente_anonimo, otra_sesion['refresh']).status_code == 401
    # La respuesta trae un par nuevo, con la forma del login, para que el usuario no quede sin sesión
    assert respuesta.data['access']
    assert respuesta.data['debe_cambiar_password'] is False
    assert refrescar(cliente_anonimo, respuesta.data['refresh']).status_code == 200


@pytest.mark.django_db
def test_confirmar_recuperacion_revoca_los_refresh_anteriores(cliente_anonimo, estudiante):
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.encoding import force_bytes
    from django.utils.http import urlsafe_base64_encode

    tokens = iniciar_sesion(cliente_anonimo, estudiante)

    respuesta = cliente_anonimo.post(
        '/api/auth/confirmar-recuperacion/',
        {
            'uid': urlsafe_base64_encode(force_bytes(estudiante.pk)),
            'token': default_token_generator.make_token(estudiante),
            'password_nuevo': 'Otra-clave-456',
        },
        format='json',
    )

    assert respuesta.status_code == 200
    assert refrescar(cliente_anonimo, tokens['refresh']).status_code == 401


# --- revocación por baja / desactivación ---

@pytest.mark.django_db
def test_baja_de_persona_revoca_sus_refresh(cliente_anonimo, api_as, admin, estudiante):
    tokens = iniciar_sesion(cliente_anonimo, estudiante)

    respuesta = api_as(admin).delete(f'/api/personas/{estudiante.persona.id}/')

    assert respuesta.status_code == 200
    assert refrescar(cliente_anonimo, tokens['refresh']).status_code == 401


@pytest.mark.django_db
def test_persona_dada_de_baja_no_obtiene_ticket_ni_accede_con_su_access(cliente_anonimo, estudiante):
    tokens = iniciar_sesion(cliente_anonimo, estudiante)
    estudiante.persona.soft_delete()
    cliente_anonimo.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')

    assert cliente_anonimo.post('/api/ws/ticket/').status_code == 401
    assert cliente_anonimo.get('/api/auth/me/').status_code == 401


@pytest.mark.django_db
def test_restaurar_persona_permite_volver_a_ingresar(cliente_anonimo, estudiante):
    estudiante.persona.soft_delete()
    respuesta = cliente_anonimo.post(
        '/api/auth/login/', {'dni': estudiante.persona.dni, 'password': PASSWORD_PRUEBA}, format='json'
    )
    assert respuesta.status_code == 400

    estudiante.persona.refresh_from_db()
    estudiante.persona.restore()

    iniciar_sesion(cliente_anonimo, estudiante)


@pytest.mark.django_db
def test_desactivar_usuario_revoca_sus_refresh(cliente_anonimo, estudiante):
    tokens = iniciar_sesion(cliente_anonimo, estudiante)

    estudiante.activo = False
    estudiante.save()

    assert refrescar(cliente_anonimo, tokens['refresh']).status_code == 401


# --- servicio ---

@pytest.mark.django_db
def test_revocar_sesiones_solo_afecta_al_usuario_dado(estudiante, profesor):
    RefreshToken.for_user(estudiante)
    RefreshToken.for_user(estudiante)
    RefreshToken.for_user(profesor)

    revocados = revocar_sesiones(estudiante)

    assert revocados == 2
    assert BlacklistedToken.objects.filter(token__user=estudiante).count() == 2
    assert not BlacklistedToken.objects.filter(token__user=profesor).exists()


@pytest.mark.django_db
def test_revocar_sesiones_es_idempotente(estudiante):
    RefreshToken.for_user(estudiante)

    assert revocar_sesiones(estudiante) == 1
    assert revocar_sesiones(estudiante) == 0
    assert OutstandingToken.objects.filter(user=estudiante).count() == 1
