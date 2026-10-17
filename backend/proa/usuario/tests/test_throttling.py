import pytest
from django.conf import settings
from django.core.cache import cache
from rest_framework.throttling import ScopedRateThrottle

LOGIN = '/api/auth/login/'
SOLICITAR = '/api/auth/solicitar-recuperacion/'
CONFIRMAR = '/api/auth/confirmar-recuperacion/'


@pytest.fixture(autouse=True)
def cache_limpia():
    # El contador vive en la caché: se limpia entre casos para que no se arrastre
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def tasas(monkeypatch):
    # THROTTLE_RATES se lee al importar DRF: se reemplaza el atributo de clase, no el setting
    def _fijar(**nuevas):
        monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {**ScopedRateThrottle.THROTTLE_RATES, **nuevas})

    return _fijar


def test_las_tasas_de_produccion_estan_definidas_en_settings():
    tasas = settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
    assert tasas['login'] and tasas['recuperacion']


@pytest.mark.django_db
def test_login_responde_429_al_superar_el_limite(cliente_anonimo, tasas):
    tasas(login='5/min')
    cuerpo = {'dni': '1', 'password': 'incorrecta'}
    for _ in range(5):
        assert cliente_anonimo.post(LOGIN, cuerpo, format='json').status_code == 400
    sexto = cliente_anonimo.post(LOGIN, cuerpo, format='json')
    assert sexto.status_code == 429
    assert 'Demasiados intentos' in sexto.json()['detail']
    assert sexto['Retry-After']


@pytest.mark.django_db
def test_el_login_valido_tambien_cuenta_y_se_bloquea(cliente_anonimo, estudiante, tasas):
    from usuario.tests.factories import PASSWORD_PRUEBA

    tasas(login='2/min')
    cuerpo = {'dni': estudiante.persona.dni, 'password': PASSWORD_PRUEBA}
    assert cliente_anonimo.post(LOGIN, cuerpo, format='json').status_code == 200
    assert cliente_anonimo.post(LOGIN, cuerpo, format='json').status_code == 200
    assert cliente_anonimo.post(LOGIN, cuerpo, format='json').status_code == 429


@pytest.mark.django_db
def test_solicitar_recuperacion_responde_429_al_cuarto_pedido(cliente_anonimo, tasas):
    tasas(recuperacion='3/hour')
    for _ in range(3):
        assert cliente_anonimo.post(SOLICITAR, {'email': 'nadie@ejemplo.test'}, format='json').status_code == 200
    cuarto = cliente_anonimo.post(SOLICITAR, {'email': 'nadie@ejemplo.test'}, format='json')
    assert cuarto.status_code == 429
    assert 'Demasiados intentos' in cuarto.json()['detail']


@pytest.mark.django_db
def test_confirmar_recuperacion_tiene_su_propio_limite(cliente_anonimo, tasas):
    tasas(recuperacion_confirmar='2/hour')
    cuerpo = {'uid': 'x', 'token': 'y', 'password_nuevo': 'Clave-de-prueba-123'}
    assert cliente_anonimo.post(CONFIRMAR, cuerpo, format='json').status_code == 400
    assert cliente_anonimo.post(CONFIRMAR, cuerpo, format='json').status_code == 400
    assert cliente_anonimo.post(CONFIRMAR, cuerpo, format='json').status_code == 429


@pytest.mark.django_db
def test_los_limites_son_independientes_por_endpoint(cliente_anonimo, tasas):
    tasas(login='1/min', recuperacion='5/hour')
    cuerpo = {'dni': '1', 'password': 'x'}
    cliente_anonimo.post(LOGIN, cuerpo, format='json')
    assert cliente_anonimo.post(LOGIN, cuerpo, format='json').status_code == 429
    assert cliente_anonimo.post(SOLICITAR, {'email': 'a@ejemplo.test'}, format='json').status_code == 200


@pytest.mark.django_db
def test_el_limite_es_por_ip(tasas):
    from rest_framework.test import APIClient

    tasas(login='1/min')
    cuerpo = {'dni': '1', 'password': 'x'}
    uno, otro = APIClient(REMOTE_ADDR='10.0.0.1'), APIClient(REMOTE_ADDR='10.0.0.2')
    uno.post(LOGIN, cuerpo, format='json')
    assert uno.post(LOGIN, cuerpo, format='json').status_code == 429
    assert otro.post(LOGIN, cuerpo, format='json').status_code == 400


# --- Evasión por X-Forwarded-For y fuerza bruta distribuida (revisión de seguridad) ---

@pytest.mark.django_db
def test_cambiar_x_forwarded_for_no_reinicia_el_contador(cliente_anonimo, tasas):
    # nginx pisa la cabecera con la IP real: el cliente solo controla los valores previos al último
    tasas(login='2/min')
    cuerpo = {'dni': '1', 'password': 'x'}
    for falsa in ('1.1.1.1, 9.9.9.9', '2.2.2.2, 9.9.9.9'):
        assert cliente_anonimo.post(LOGIN, cuerpo, format='json', HTTP_X_FORWARDED_FOR=falsa).status_code == 400
    tercera = cliente_anonimo.post(LOGIN, cuerpo, format='json', HTTP_X_FORWARDED_FOR='3.3.3.3, 9.9.9.9')
    assert tercera.status_code == 429


@pytest.mark.django_db
def test_mismo_dni_desde_distintas_ips_se_bloquea(tasas):
    from rest_framework.test import APIClient

    tasas(login_dni='3/hour')
    for n in range(3):
        cliente = APIClient(REMOTE_ADDR=f'10.0.0.{n}')
        assert cliente.post(LOGIN, {'dni': '12.345.678', 'password': 'x'}, format='json').status_code == 400
    # El DNI se normaliza: con o sin puntos es la misma cuenta
    otra = APIClient(REMOTE_ADDR='10.0.0.99')
    assert otra.post(LOGIN, {'dni': ' 12345678 ', 'password': 'x'}, format='json').status_code == 429
    # Otro DNI desde otra IP sigue pudiendo intentar
    assert otra.post(LOGIN, {'dni': '87654321', 'password': 'x'}, format='json').status_code == 400


@pytest.mark.django_db
def test_mismo_email_desde_distintas_ips_se_bloquea(tasas):
    from rest_framework.test import APIClient

    tasas(recuperacion_email='2/hour')
    for n, email in enumerate(('Ana@Ejemplo.test', 'ana@ejemplo.test')):
        cliente = APIClient(REMOTE_ADDR=f'10.0.1.{n}')
        assert cliente.post(SOLICITAR, {'email': email}, format='json').status_code == 200
    tercero = APIClient(REMOTE_ADDR='10.0.1.50').post(SOLICITAR, {'email': ' ANA@ejemplo.test '}, format='json')
    assert tercero.status_code == 429


@pytest.mark.django_db
def test_el_identificador_no_se_guarda_en_claro_en_la_cache(cliente_anonimo):
    cliente_anonimo.post(LOGIN, {'dni': '30111222', 'password': 'x'}, format='json')
    cliente_anonimo.post(SOLICITAR, {'email': 'privado@ejemplo.test'}, format='json')
    claves = ' '.join(str(k) for k in cache._cache)
    assert '30111222' not in claves and 'privado' not in claves


@pytest.mark.django_db
def test_flujo_legitimo_sigue_funcionando_con_las_tasas_por_defecto(cliente_anonimo, estudiante):
    from usuario.tests.factories import PASSWORD_PRUEBA

    respuesta = cliente_anonimo.post(
        LOGIN, {'dni': estudiante.persona.dni, 'password': PASSWORD_PRUEBA}, format='json')
    assert respuesta.status_code == 200


def test_num_proxies_configurado_para_un_solo_proxy():
    assert settings.REST_FRAMEWORK['NUM_PROXIES'] == 1
    assert {'login_dni', 'recuperacion_email'} <= set(settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'])
