import importlib
import os
from unittest import mock

import pytest
from django.core.exceptions import ImproperlyConfigured

from proa.entorno import (
    CLAVE_SECRETA_DESARROLLO,
    clave_secreta,
    hosts_permitidos,
    lista_desde_entorno,
    origenes_cors,
    origenes_csrf,
)


# --- lista_desde_entorno ---

def test_la_lista_ignora_espacios_y_elementos_vacios():
    entorno = {'X': ' a.com , b.com,, ,c.com '}
    assert lista_desde_entorno('X', entorno=entorno) == ['a.com', 'b.com', 'c.com']


def test_la_lista_sin_variable_o_vacia_usa_el_valor_por_defecto():
    assert lista_desde_entorno('X', ['x'], entorno={}) == ['x']
    assert lista_desde_entorno('X', ['x'], entorno={'X': '  '}) == ['x']


def test_el_valor_por_defecto_no_se_comparte_entre_llamadas():
    por_defecto = ['x']
    lista_desde_entorno('X', por_defecto, entorno={}).append('y')
    assert por_defecto == ['x']


# --- clave secreta ---

def test_sin_debug_y_sin_clave_falla_con_un_mensaje_claro():
    with pytest.raises(ImproperlyConfigured) as error:
        clave_secreta(debug=False, entorno={})
    assert 'DJANGO_SECRET_KEY' in str(error.value)


def test_sin_debug_la_clave_de_desarrollo_o_la_vacia_se_rechazan():
    for valor in (CLAVE_SECRETA_DESARROLLO, '   ', 'django-insecure-abc'):
        with pytest.raises(ImproperlyConfigured):
            clave_secreta(debug=False, entorno={'DJANGO_SECRET_KEY': valor})


def test_sin_debug_usa_la_clave_del_entorno():
    assert clave_secreta(debug=False, entorno={'DJANGO_SECRET_KEY': 'k' * 50}) == 'k' * 50


def test_key_secret_sigue_valiendo_como_alias_y_avisa():
    with pytest.warns(DeprecationWarning, match='KEY_SECRET'):
        assert clave_secreta(debug=False, entorno={'KEY_SECRET': 'k' * 50}) == 'k' * 50


def test_django_secret_key_tiene_prioridad_sobre_el_alias():
    entorno = {'DJANGO_SECRET_KEY': 'nueva' * 10, 'KEY_SECRET': 'vieja' * 10}
    assert clave_secreta(debug=False, entorno=entorno) == 'nueva' * 10


def test_con_debug_sin_clave_usa_la_clave_de_desarrollo():
    assert clave_secreta(debug=True, entorno={}) == CLAVE_SECRETA_DESARROLLO
    assert 'desarrollo' in CLAVE_SECRETA_DESARROLLO


# --- hosts y orígenes ---

def test_con_debug_los_hosts_y_origenes_tienen_valores_locales_por_defecto():
    assert 'localhost' in hosts_permitidos(True, {})
    assert 'http://localhost:4200' in origenes_cors(True, {})
    assert 'http://localhost:4200' in origenes_csrf(True, {})


def test_sin_debug_no_hay_valores_por_defecto():
    assert hosts_permitidos(False, {}) == []
    assert origenes_cors(False, {}) == []
    assert origenes_csrf(False, {}) == []


def test_el_entorno_pisa_los_valores_por_defecto():
    entorno = {
        'DJANGO_ALLOWED_HOSTS': 'proa.example.com',
        'DJANGO_CORS_ALLOWED_ORIGINS': 'https://proa.example.com, https://otro.example.com',
        'DJANGO_CSRF_TRUSTED_ORIGINS': 'https://proa.example.com',
    }
    for debug in (True, False):
        assert hosts_permitidos(debug, entorno) == ['proa.example.com']
        assert origenes_cors(debug, entorno) == ['https://proa.example.com', 'https://otro.example.com']
        assert origenes_csrf(debug, entorno) == ['https://proa.example.com']


# --- settings.py cargado de verdad ---

def limpiar(modulo):
    # reload() vuelve a ejecutar el módulo sobre el mismo espacio de nombres: lo que solo se define
    # sin DEBUG sobreviviría a una recarga con DEBUG
    for nombre in ('SECURE_PROXY_SSL_HEADER', 'SESSION_COOKIE_SECURE', 'CSRF_COOKIE_SECURE'):
        vars(modulo).pop(nombre, None)


def recargar_settings(entorno):
    from proa import settings as modulo

    limpiar(modulo)
    claves = ('DJANGO_DEBUG', 'DJANGO_SECRET_KEY', 'KEY_SECRET', 'DJANGO_ALLOWED_HOSTS',
              'DJANGO_CORS_ALLOWED_ORIGINS', 'DJANGO_CSRF_TRUSTED_ORIGINS')
    base = {k: v for k, v in os.environ.items() if k not in claves}
    # load_dotenv se anula: un backend/.env real no debe cambiar el resultado de la prueba
    with mock.patch.dict(os.environ, {**base, **entorno}, clear=True), mock.patch('dotenv.load_dotenv'):
        return importlib.reload(modulo)


def restaurar_settings():
    from proa import settings as modulo

    limpiar(modulo)
    importlib.reload(modulo)


def test_settings_sin_debug_y_sin_clave_no_arranca():
    try:
        with pytest.raises(ImproperlyConfigured):
            recargar_settings({'DJANGO_DEBUG': 'False'})
    finally:
        restaurar_settings()


def test_settings_sin_debug_aplica_hosts_del_entorno_y_cookies_seguras():
    try:
        s = recargar_settings({
            'DJANGO_DEBUG': 'False', 'DJANGO_SECRET_KEY': 'k' * 50,
            'DJANGO_ALLOWED_HOSTS': 'proa.example.com',
            'DJANGO_CORS_ALLOWED_ORIGINS': 'https://proa.example.com',
            'DJANGO_CSRF_TRUSTED_ORIGINS': 'https://proa.example.com',
        })
        assert s.SECRET_KEY == 'k' * 50
        assert s.ALLOWED_HOSTS == ['proa.example.com']
        assert s.CORS_ALLOWED_ORIGINS == ['https://proa.example.com']
        assert s.CSRF_TRUSTED_ORIGINS == ['https://proa.example.com']
        assert s.SECURE_PROXY_SSL_HEADER == ('HTTP_X_FORWARDED_PROTO', 'https')
        assert s.SESSION_COOKIE_SECURE is True
        assert s.CSRF_COOKIE_SECURE is True
        assert s.SECURE_CONTENT_TYPE_NOSNIFF is True
        assert not getattr(s, 'SECURE_SSL_REDIRECT', False)  # un redirect rompería el compose local
    finally:
        restaurar_settings()


def test_settings_con_debug_usa_la_clave_y_los_origenes_de_desarrollo():
    try:
        s = recargar_settings({'DJANGO_DEBUG': 'True'})
        assert s.SECRET_KEY == CLAVE_SECRETA_DESARROLLO
        assert 'localhost' in s.ALLOWED_HOSTS
        assert 'http://localhost:4200' in s.CORS_ALLOWED_ORIGINS
        assert not getattr(s, 'SESSION_COOKIE_SECURE', False)
        assert getattr(s, 'SECURE_PROXY_SSL_HEADER', None) is None
    finally:
        restaurar_settings()
