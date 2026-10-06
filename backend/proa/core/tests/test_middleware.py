import pytest
from django.core.exceptions import MiddlewareNotUsed
from django.test import RequestFactory
from rest_framework.test import APIClient

from core.middleware import MedicionMiddleware

MIDDLEWARES_BASE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
]


@pytest.fixture
def con_medicion(settings):
    settings.DEBUG = True
    settings.MIDDLEWARE = ['core.middleware.MedicionMiddleware', *MIDDLEWARES_BASE]


@pytest.mark.django_db
def test_con_debug_la_respuesta_trae_cabeceras_de_medicion(con_medicion, admin):
    cliente = APIClient()
    cliente.force_authenticate(user=admin)

    respuesta = cliente.get('/api/materias/')

    assert respuesta.status_code == 200
    assert int(respuesta['X-Query-Count']) >= 1
    assert float(respuesta['X-Response-Time-ms']) >= 0


@pytest.mark.django_db
def test_la_cuenta_de_consultas_es_por_pedido(con_medicion, admin):
    cliente = APIClient()
    cliente.force_authenticate(user=admin)

    primero = int(cliente.get('/api/materias/')['X-Query-Count'])
    segundo = int(cliente.get('/api/materias/')['X-Query-Count'])

    assert primero == segundo


def test_sin_debug_el_middleware_no_se_activa(settings):
    settings.DEBUG = False

    with pytest.raises(MiddlewareNotUsed):
        MedicionMiddleware(lambda request: None)


@pytest.mark.django_db
def test_sin_debug_no_hay_cabeceras(admin):
    cliente = APIClient()
    cliente.force_authenticate(user=admin)

    respuesta = cliente.get('/api/materias/')

    assert 'X-Query-Count' not in respuesta
    assert 'X-Response-Time-ms' not in respuesta
