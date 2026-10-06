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
