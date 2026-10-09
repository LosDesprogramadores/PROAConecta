from unittest import mock

import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from usuario.models import Usuario
from usuario.tests.factories import PASSWORD_PRUEBA, UsuarioFactory

LOGIN = '/api/auth/login/'
CAMBIAR = '/api/auth/cambiar-password-primer-ingreso/'
CONFIRMAR = '/api/auth/confirmar-recuperacion/'
MENSAJE_GENERICO = 'DNI o contraseña incorrectos.'


@pytest.fixture(autouse=True)
def cache_limpia():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def tasas(monkeypatch):
    def _fijar(**nuevas):
        monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {**ScopedRateThrottle.THROTTLE_RATES, **nuevas})

    return _fijar


def _enlace(usuario):
    return {'uid': urlsafe_base64_encode(force_bytes(usuario.pk)), 'token': default_token_generator.make_token(usuario)}


CLAVES_RECHAZADAS = [
    ('comun', 'password123'),
    ('numerica', '8734659021'),
    ('parecida_al_usuario', '{dni}ab'),
]


# --- Validación de la clave nueva (FR-006) ---

@pytest.mark.django_db
@pytest.mark.parametrize('motivo, clave', CLAVES_RECHAZADAS, ids=[c[0] for c in CLAVES_RECHAZADAS])
def test_cambiar_password_rechaza_claves_debiles(api_as, motivo, clave):
    usuario = UsuarioFactory(debe_cambiar_password=True)
    clave = clave.format(dni=usuario.persona.dni)
    respuesta = api_as(usuario).post(
        CAMBIAR, {'password_actual': PASSWORD_PRUEBA, 'password_nuevo': clave}, format='json')
    assert respuesta.status_code == 400
    usuario.refresh_from_db()
    assert usuario.check_password(PASSWORD_PRUEBA)
    assert usuario.debe_cambiar_password is True


@pytest.mark.django_db
def test_cambiar_password_rechaza_la_clave_igual_al_dni(api_as):
    usuario = UsuarioFactory(debe_cambiar_password=True)
    respuesta = api_as(usuario).post(
        CAMBIAR, {'password_actual': PASSWORD_PRUEBA, 'password_nuevo': usuario.persona.dni}, format='json')
    assert respuesta.status_code == 400
    assert 'DNI' in respuesta.json()['detail']


@pytest.mark.django_db
def test_cambiar_password_acepta_una_clave_valida(api_as):
    usuario = UsuarioFactory(debe_cambiar_password=True)
    respuesta = api_as(usuario).post(
        CAMBIAR, {'password_actual': PASSWORD_PRUEBA, 'password_nuevo': 'Otra-clave-segura-481'}, format='json')
    assert respuesta.status_code == 200
    usuario.refresh_from_db()
    assert usuario.check_password('Otra-clave-segura-481')


@pytest.mark.django_db
@pytest.mark.parametrize('motivo, clave', CLAVES_RECHAZADAS, ids=[c[0] for c in CLAVES_RECHAZADAS])
def test_confirmar_recuperacion_rechaza_claves_debiles(cliente_anonimo, motivo, clave):
    usuario = UsuarioFactory()
    clave = clave.format(dni=usuario.persona.dni)
    respuesta = cliente_anonimo.post(CONFIRMAR, {**_enlace(usuario), 'password_nuevo': clave}, format='json')
    assert respuesta.status_code == 400
    usuario.refresh_from_db()
    assert usuario.check_password(PASSWORD_PRUEBA)


@pytest.mark.django_db
def test_confirmar_recuperacion_rechaza_la_clave_igual_al_dni(cliente_anonimo):
    usuario = UsuarioFactory()
    respuesta = cliente_anonimo.post(
        CONFIRMAR, {**_enlace(usuario), 'password_nuevo': usuario.persona.dni}, format='json')
    assert respuesta.status_code == 400
    assert 'DNI' in respuesta.json()['detail']


@pytest.mark.django_db
def test_confirmar_recuperacion_acepta_una_clave_valida(cliente_anonimo):
    usuario = UsuarioFactory()
    respuesta = cliente_anonimo.post(
        CONFIRMAR, {**_enlace(usuario), 'password_nuevo': 'Otra-clave-segura-481'}, format='json')
    assert respuesta.status_code == 200
    usuario.refresh_from_db()
    assert usuario.check_password('Otra-clave-segura-481')


# --- Login sin pistas sobre la cuenta (FR-007) ---

@pytest.mark.django_db
def test_dni_inexistente_clave_erronea_e_inactivo_responden_igual(cliente_anonimo):
    existente = UsuarioFactory()
    inactivo = UsuarioFactory(activo=False)
    intentos = [
        {'dni': '99999999', 'password': 'x'},
        {'dni': existente.persona.dni, 'password': 'incorrecta'},
        {'dni': inactivo.persona.dni, 'password': PASSWORD_PRUEBA},
    ]
    respuestas = [cliente_anonimo.post(LOGIN, cuerpo, format='json') for cuerpo in intentos]
    assert {r.status_code for r in respuestas} == {400}
    assert all(r.json() == respuestas[0].json() for r in respuestas)
    assert MENSAJE_GENERICO in str(respuestas[0].json())
    assert 'inactivo' not in str(respuestas[2].json())


@pytest.mark.django_db
def test_dni_inexistente_tambien_calcula_un_hash(cliente_anonimo):
    with mock.patch.object(Usuario, 'set_password') as calcular:
        cliente_anonimo.post(LOGIN, {'dni': '99999999', 'password': 'x'}, format='json')
    calcular.assert_called_once_with('x')


@pytest.mark.django_db
def test_dni_existente_con_clave_erronea_calcula_un_hash(cliente_anonimo):
    usuario = UsuarioFactory()
    with mock.patch.object(Usuario, 'check_password', return_value=False) as comparar:
        cliente_anonimo.post(LOGIN, {'dni': usuario.persona.dni, 'password': 'x'}, format='json')
    comparar.assert_called_once_with('x')


# --- Límite por cuenta: solo fallos, se reinicia al entrar (FR-008) ---

@pytest.mark.django_db
def test_los_logins_exitosos_no_consumen_el_limite_por_cuenta(tasas):
    tasas(login='1000/min', login_dni='10/hour')
    usuario = UsuarioFactory()
    cuerpo = {'dni': usuario.persona.dni, 'password': PASSWORD_PRUEBA}
    for _ in range(10):
        assert APIClient().post(LOGIN, cuerpo, format='json').status_code == 200
    assert APIClient().post(LOGIN, cuerpo, format='json').status_code == 200


@pytest.mark.django_db
def test_los_fallos_bloquean_la_cuenta_y_conserva_el_mensaje(tasas):
    tasas(login='1000/min', login_dni='3/hour')
    usuario = UsuarioFactory()
    malo = {'dni': usuario.persona.dni, 'password': 'incorrecta'}
    for _ in range(3):
        assert APIClient().post(LOGIN, malo, format='json').status_code == 400
    bloqueado = APIClient().post(
        LOGIN, {'dni': usuario.persona.dni, 'password': PASSWORD_PRUEBA}, format='json')
    assert bloqueado.status_code == 429
    assert 'Demasiados intentos' in bloqueado.json()['detail']
    assert bloqueado['Retry-After']


@pytest.mark.django_db
def test_un_login_exitoso_reinicia_la_cuenta_de_fallos(tasas):
    tasas(login='1000/min', login_dni='3/hour')
    usuario = UsuarioFactory()
    malo = {'dni': usuario.persona.dni, 'password': 'incorrecta'}
    bueno = {'dni': usuario.persona.dni, 'password': PASSWORD_PRUEBA}
    for _ in range(2):
        assert APIClient().post(LOGIN, malo, format='json').status_code == 400
    assert APIClient().post(LOGIN, bueno, format='json').status_code == 200
    for _ in range(3):
        assert APIClient().post(LOGIN, malo, format='json').status_code == 400
    assert APIClient().post(LOGIN, bueno, format='json').status_code == 429


@pytest.mark.django_db
def test_el_limite_por_cuenta_no_afecta_a_otra_cuenta(tasas):
    tasas(login='1000/min', login_dni='2/hour')
    otro = UsuarioFactory()
    for _ in range(2):
        APIClient().post(LOGIN, {'dni': '99999999', 'password': 'x'}, format='json')
    respuesta = APIClient().post(LOGIN, {'dni': otro.persona.dni, 'password': PASSWORD_PRUEBA}, format='json')
    assert respuesta.status_code == 200


# --- Admin con UserAdmin (FR-009) ---

@pytest.mark.django_db
def test_usuario_esta_registrado_con_user_admin():
    from django.contrib import admin
    from django.contrib.auth.admin import UserAdmin

    assert isinstance(admin.site._registry[Usuario], UserAdmin)


@pytest.mark.django_db
def test_el_alta_desde_el_admin_guarda_la_clave_con_hash(client):
    from usuario.tests.factories import PersonaFactory

    superusuario = Usuario.objects.create_superuser(username='root-admin', password='Clave-root-segura-77')
    client.force_login(superusuario)
    persona = PersonaFactory()
    respuesta = client.post('/admin/usuario/usuario/add/', {
        'username': persona.dni, 'password1': 'Clave-nueva-segura-52', 'password2': 'Clave-nueva-segura-52',
        'persona': persona.pk, 'nombre_usuario': persona.dni,
    })
    assert respuesta.status_code == 302
    creado = Usuario.objects.get(username=persona.dni)
    assert creado.password != 'Clave-nueva-segura-52'
    assert creado.check_password('Clave-nueva-segura-52')


# --- Límite por cuenta: reserva atómica y normalización ---

def _limite(dni):
    from types import SimpleNamespace

    from core.throttling import LimitePorIdentificadorThrottle

    vista = SimpleNamespace(throttle_identificador=('dni', 'login_dni'))
    return LimitePorIdentificadorThrottle(), SimpleNamespace(data={'dni': dni}), vista


@pytest.mark.django_db
def test_pedidos_concurrentes_no_pasan_todos_antes_de_registrar_un_fallo(tasas):
    # Simula N pedidos en vuelo: ninguno terminó de autenticar, pero cada uno ya reservó su cupo
    tasas(login_dni='3/hour')
    resultados = []
    for _ in range(5):
        limite, request, vista = _limite('12345678')
        resultados.append(limite.allow_request(request, vista))
    assert resultados == [True, True, True, False, False]


@pytest.mark.django_db
def test_el_limite_reporta_cuanto_falta_para_que_venza_la_ventana(tasas):
    tasas(login_dni='1/hour')
    for _ in range(2):
        limite, request, vista = _limite('12345678')
        limite.allow_request(request, vista)
    assert 0 < limite.wait() <= 3600


@pytest.mark.django_db
def test_si_la_ventana_vence_entre_el_add_y_el_incr_abre_otra_con_vencimiento(tasas):
    tasas(login_dni='3/hour')
    limite, request, vista = _limite('12345678')
    incr_original = limite.cache.incr
    llamadas = []

    def incr_que_vence_una_vez(clave, *args, **kwargs):
        if not llamadas:
            llamadas.append(clave)
            limite.cache.delete(clave)
            limite.cache.delete(f'{clave}:inicio')
        return incr_original(clave, *args, **kwargs)

    with mock.patch.object(limite.cache, 'incr', side_effect=incr_que_vence_una_vez):
        assert limite.allow_request(request, vista) is True
    assert limite.cache.get(limite.key) == 1
    assert limite.cache.get(limite.key_inicio) is not None


@pytest.mark.django_db
def test_un_login_exitoso_borra_el_contador_de_la_cuenta(tasas):
    tasas(login='1000/min', login_dni='10/hour')
    dni = UsuarioFactory().persona.dni
    cliente = APIClient()
    cliente.post(LOGIN, {'dni': dni, 'password': 'incorrecta'}, format='json')
    limite, request, vista = _limite(dni)
    limite._preparar(request, vista)
    assert limite.cache.get(limite.key) == 1
    respuesta = cliente.post(LOGIN, {'dni': dni, 'password': PASSWORD_PRUEBA}, format='json')
    assert respuesta.status_code == 200
    assert limite.cache.get(limite.key) is None
    assert limite.cache.get(limite.key_inicio) is None


@pytest.mark.django_db
def test_limpiar_reinicia_el_contador(tasas):
    tasas(login_dni='1/hour')
    limite, request, vista = _limite('12345678')
    assert limite.allow_request(request, vista) is True
    limite, request, vista = _limite('12345678')
    limite.limpiar(request, vista)
    limite, request, vista = _limite('12345678')
    assert limite.allow_request(request, vista) is True


@pytest.mark.django_db
@pytest.mark.parametrize('variante', ['12.345.678', ' 12345678 ', '12345678'])
def test_las_variantes_del_dni_comparten_el_mismo_cupo(tasas, variante):
    tasas(login='1000/min', login_dni='3/hour')
    UsuarioFactory(persona__dni='12345678')
    for otra in ('12.345.678', ' 12345678 ', '12345678'):
        assert APIClient().post(LOGIN, {'dni': otra, 'password': 'incorrecta'}, format='json').status_code == 400
    bloqueado = APIClient().post(LOGIN, {'dni': variante, 'password': PASSWORD_PRUEBA}, format='json')
    assert bloqueado.status_code == 429


@pytest.mark.django_db
def test_el_dni_con_letras_en_otra_capitalizacion_es_la_misma_cuenta(tasas):
    tasas(login='1000/min', login_dni='2/hour')
    for dni in ('AB123', 'ab123'):
        assert APIClient().post(LOGIN, {'dni': dni, 'password': 'x'}, format='json').status_code == 400
    assert APIClient().post(LOGIN, {'dni': 'Ab123', 'password': 'x'}, format='json').status_code == 429


@pytest.mark.django_db
def test_login_sin_password_responde_400_y_consume_cupo(tasas):
    # Con DNI y sin clave el pedido igual reserva cupo: no se puede sondear una cuenta gratis
    tasas(login='1000/min', login_dni='2/hour')
    for _ in range(2):
        assert APIClient().post(LOGIN, {'dni': '12345678'}, format='json').status_code == 400
    assert APIClient().post(LOGIN, {'dni': '12345678', 'password': 'x'}, format='json').status_code == 429


@pytest.mark.django_db
def test_login_con_cuerpo_malformado_responde_400_sin_error_de_servidor(tasas):
    # Sin DNI no hay cuenta a la cual contar: solo aplica el límite por IP
    tasas(login='1000/min', login_dni='1/hour')
    for cuerpo in ({}, {'password': 'x'}, [], 'texto'):
        assert APIClient().post(LOGIN, cuerpo, format='json').status_code == 400
    assert APIClient().post(LOGIN, {'dni': '12345678', 'password': 'x'}, format='json').status_code == 400


@pytest.mark.django_db
def test_recuperacion_email_cuenta_todos_los_pedidos(tasas):
    tasas(recuperacion='1000/hour', recuperacion_email='2/hour')
    cuerpo = {'email': 'ana@ejemplo.test'}
    for _ in range(2):
        assert APIClient().post('/api/auth/solicitar-recuperacion/', cuerpo, format='json').status_code == 200
    assert APIClient().post('/api/auth/solicitar-recuperacion/', cuerpo, format='json').status_code == 429


# --- Alta de usuario: la clave se valida igual que en el cambio y la recuperación ---

@pytest.mark.django_db
@pytest.mark.parametrize('clave', ['password123', '8734659021', '12345678', '12.345.678', ' 12345678 '])
def test_admin_no_puede_crear_un_usuario_con_clave_debil_o_igual_al_dni(api_as, admin, clave):
    from usuario.tests.factories import PersonaFactory

    persona = PersonaFactory(dni='12345678')
    respuesta = api_as(admin).post('/api/usuarios/', {'persona_id': persona.pk, 'password': clave}, format='json')
    assert respuesta.status_code == 400
    assert 'password' in respuesta.json()
    assert not Usuario.objects.filter(persona=persona).exists()


@pytest.mark.django_db
def test_admin_crea_un_usuario_con_clave_valida(api_as, admin):
    from usuario.tests.factories import PersonaFactory

    persona = PersonaFactory()
    respuesta = api_as(admin).post(
        '/api/usuarios/', {'persona_id': persona.pk, 'password': 'Otra-clave-segura-481'}, format='json')
    assert respuesta.status_code == 201
    assert Usuario.objects.get(persona=persona).check_password('Otra-clave-segura-481')


@pytest.mark.django_db
def test_cambiar_password_compara_el_dni_normalizado(api_as):
    usuario = UsuarioFactory(debe_cambiar_password=True, persona__dni='12345678')
    respuesta = api_as(usuario).post(
        CAMBIAR, {'password_actual': PASSWORD_PRUEBA, 'password_nuevo': ' 12.345.678 '}, format='json')
    assert respuesta.status_code == 400
    assert 'DNI' in respuesta.json()['detail']
