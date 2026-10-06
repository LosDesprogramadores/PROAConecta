"""Cada módulo de proa/settings/ se importa de verdad, con un entorno controlado (T059)."""
import importlib
import os
import subprocess
import sys
from unittest import mock

import pytest
from django.core.exceptions import ImproperlyConfigured

from proa.entorno import CLAVE_SECRETA_DESARROLLO

MODULOS = ('proa.settings.base', 'proa.settings.dev', 'proa.settings.prod', 'proa.settings.test')
VARIABLES = ('DJANGO_DEBUG', 'DJANGO_SECRET_KEY', 'KEY_SECRET', 'DJANGO_ALLOWED_HOSTS',
             'DJANGO_CORS_ALLOWED_ORIGINS', 'DJANGO_CSRF_TRUSTED_ORIGINS', 'REDIS_URL')

ENTORNO_PROD = {
    'DJANGO_SECRET_KEY': 'k' * 50,
    'DJANGO_ALLOWED_HOSTS': 'proa.example.com',
    'DJANGO_CORS_ALLOWED_ORIGINS': 'https://proa.example.com',
    'DJANGO_CSRF_TRUSTED_ORIGINS': 'https://proa.example.com',
}


def importar(nombre, entorno):
    """Importa el módulo desde cero con solo ``entorno`` como variables relevantes y lo deja fuera de sys.modules."""
    guardados = {m: sys.modules.pop(m, None) for m in MODULOS}
    base = {k: v for k, v in os.environ.items() if k not in VARIABLES}
    try:
        # load_dotenv se anula: un backend/.env real no debe cambiar el resultado de la prueba
        with mock.patch.dict(os.environ, {**base, **entorno}, clear=True), mock.patch('dotenv.load_dotenv'):
            return importlib.import_module(nombre)
    finally:
        for m in MODULOS:
            sys.modules.pop(m, None)
            if guardados[m] is not None:
                sys.modules[m] = guardados[m]


@pytest.mark.parametrize('nombre,entorno', [
    ('proa.settings.base', {}),
    ('proa.settings.dev', {}),
    ('proa.settings.prod', ENTORNO_PROD),
    ('proa.settings.test', {}),
])
def test_cada_modulo_de_settings_se_importa_con_su_entorno(nombre, entorno):
    s = importar(nombre, entorno)
    assert s.BASE_DIR.name == 'proa' and (s.BASE_DIR / 'manage.py').exists()
    assert s.ROOT_URLCONF == 'proa.urls'


def test_base_no_define_los_valores_propios_de_cada_entorno():
    s = importar('proa.settings.base', {})
    for nombre in ('DEBUG', 'SECRET_KEY', 'ALLOWED_HOSTS', 'CORS_ALLOWED_ORIGINS', 'CSRF_TRUSTED_ORIGINS'):
        assert not hasattr(s, nombre)


def test_prod_sin_clave_secreta_no_arranca():
    with pytest.raises(ImproperlyConfigured) as error:
        importar('proa.settings.prod', {})
    assert 'DJANGO_SECRET_KEY' in str(error.value)


def test_prod_rechaza_la_clave_de_desarrollo():
    with pytest.raises(ImproperlyConfigured):
        importar('proa.settings.prod', {'DJANGO_SECRET_KEY': CLAVE_SECRETA_DESARROLLO})


def test_prod_ignora_django_debug_y_toma_hosts_del_entorno():
    s = importar('proa.settings.prod', {**ENTORNO_PROD, 'DJANGO_DEBUG': 'True'})
    assert s.DEBUG is False
    assert s.SECRET_KEY == 'k' * 50
    assert s.ALLOWED_HOSTS == ['proa.example.com']
    assert s.CORS_ALLOWED_ORIGINS == ['https://proa.example.com']
    assert s.CSRF_TRUSTED_ORIGINS == ['https://proa.example.com']


def test_prod_sin_hosts_no_arranca():
    with pytest.raises(ImproperlyConfigured) as error:
        importar('proa.settings.prod', {'DJANGO_SECRET_KEY': 'k' * 50})
    assert 'DJANGO_ALLOWED_HOSTS' in str(error.value)


@pytest.mark.parametrize('nombre', ['asgi', 'wsgi'])
def test_asgi_y_wsgi_sin_variable_resuelven_a_prod_y_fallan_cerrado(nombre):
    # Subproceso: setdefault corre al importar y no debe contaminar este proceso
    entorno = {k: v for k, v in os.environ.items() if k not in VARIABLES + ('DJANGO_SETTINGS_MODULE',)}
    entorno['PYTHONPATH'] = os.getcwd()
    codigo = (
        'import dotenv; dotenv.load_dotenv = lambda *a, **k: False\n'
        f'import proa.{nombre}'
    )
    resultado = subprocess.run([sys.executable, '-c', codigo], env=entorno, capture_output=True, text=True)
    assert resultado.returncode != 0
    assert 'ImproperlyConfigured' in resultado.stderr
    assert 'DJANGO_SECRET_KEY' in resultado.stderr


def test_prod_aplica_cookies_seguras_y_cabecera_del_proxy():
    s = importar('proa.settings.prod', ENTORNO_PROD)
    assert s.SECURE_PROXY_SSL_HEADER == ('HTTP_X_FORWARDED_PROTO', 'https')
    assert s.SESSION_COOKIE_SECURE is True
    assert s.CSRF_COOKIE_SECURE is True
    assert s.SECURE_CONTENT_TYPE_NOSNIFF is True
    assert not getattr(s, 'SECURE_SSL_REDIRECT', False)  # un redirect rompería el compose local
    assert 'core.middleware.MedicionMiddleware' not in s.MIDDLEWARE


def test_prod_sin_redis_avisa(caplog):
    with caplog.at_level('WARNING'):
        importar('proa.settings.prod', ENTORNO_PROD)
    assert 'REDIS_URL' in caplog.text


def test_prod_con_redis_no_avisa(caplog):
    with caplog.at_level('WARNING'):
        s = importar('proa.settings.prod', {**ENTORNO_PROD, 'REDIS_URL': 'redis://redis:6379/0'})
    assert 'REDIS_URL' not in caplog.text
    assert s.CHANNEL_LAYERS['default']['BACKEND'] == 'channels_redis.core.RedisChannelLayer'


def test_dev_tiene_debug_y_valores_locales():
    s = importar('proa.settings.dev', {})
    assert s.DEBUG is True
    assert s.SECRET_KEY == CLAVE_SECRETA_DESARROLLO
    assert 'localhost' in s.ALLOWED_HOSTS
    assert 'http://localhost:4200' in s.CORS_ALLOWED_ORIGINS
    assert s.MIDDLEWARE[0] == 'core.middleware.MedicionMiddleware'
    assert s.EMAIL_BACKEND == 'django.core.mail.backends.console.EmailBackend'
    assert not getattr(s, 'SESSION_COOKIE_SECURE', False)
    assert getattr(s, 'SECURE_PROXY_SSL_HEADER', None) is None


def test_dev_toma_la_clave_y_los_hosts_del_entorno_si_existen():
    s = importar('proa.settings.dev', {'DJANGO_SECRET_KEY': 'k' * 50, 'DJANGO_ALLOWED_HOSTS': 'backend'})
    assert s.SECRET_KEY == 'k' * 50
    assert s.ALLOWED_HOSTS == ['backend']


def test_test_es_autosuficiente_sin_entorno():
    s = importar('proa.settings.test', {})
    assert s.DEBUG is False
    assert s.DATABASES['default']['ENGINE'] == 'django.db.backends.sqlite3'
    assert s.SEGUNDO_PLANO_SINCRONO is True
    assert s.EMAIL_BACKEND == 'django.core.mail.backends.locmem.EmailBackend'
    assert s.CHANNEL_LAYERS['default']['BACKEND'] == 'channels.layers.InMemoryChannelLayer'
    assert s.ALLOWED_HOSTS == ['testserver', 'localhost', '127.0.0.1']
