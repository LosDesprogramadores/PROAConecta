"""Lectura de la configuración por entorno de ``settings.py`` (X-13, T058).

Funciones puras que reciben el entorno como parámetro para poder probarlas sin tocar ``os.environ``.
Variables: ``DJANGO_SECRET_KEY`` (alias de transición ``KEY_SECRET``), ``DJANGO_ALLOWED_HOSTS``,
``DJANGO_CORS_ALLOWED_ORIGINS`` y ``DJANGO_CSRF_TRUSTED_ORIGINS``, todas separadas por comas.
"""
import os
import warnings

from django.core.exceptions import ImproperlyConfigured

# Solo para desarrollo local: nunca se acepta con DEBUG desactivado
CLAVE_SECRETA_DESARROLLO = 'clave-insegura-solo-para-desarrollo-local-no-usar-en-produccion'

HOSTS_DESARROLLO = ['127.0.0.1', 'localhost', '0.0.0.0']
ORIGENES_DESARROLLO = [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]


def lista_desde_entorno(nombre, por_defecto=(), entorno=None):
    """Lista separada por comas, sin espacios ni elementos vacíos; sin la variable devuelve una copia del valor por defecto."""
    entorno = os.environ if entorno is None else entorno
    elementos = [e.strip() for e in (entorno.get(nombre) or '').split(',') if e.strip()]
    return elementos or list(por_defecto)


def clave_secreta(debug, entorno=None):
    entorno = os.environ if entorno is None else entorno
    clave = (entorno.get('DJANGO_SECRET_KEY') or '').strip()
    if not clave and (entorno.get('KEY_SECRET') or '').strip():
        warnings.warn(
            'KEY_SECRET está en desuso: renombrala a DJANGO_SECRET_KEY en el entorno o en backend/.env.',
            DeprecationWarning,
            stacklevel=2,
        )
        clave = entorno['KEY_SECRET'].strip()
    if debug:
        return clave or CLAVE_SECRETA_DESARROLLO
    if not clave:
        raise ImproperlyConfigured(
            'DJANGO_SECRET_KEY no está definida y se usa proa.settings.prod: definí una clave secreta '
            'larga y aleatoria en el entorno (ver backend/.env.example).'
        )
    if clave == CLAVE_SECRETA_DESARROLLO or clave.startswith('django-insecure-'):
        raise ImproperlyConfigured('DJANGO_SECRET_KEY tiene una clave de desarrollo: usá una propia en producción.')
    return clave


def hosts_permitidos(debug, entorno=None):
    return lista_desde_entorno('DJANGO_ALLOWED_HOSTS', HOSTS_DESARROLLO if debug else (), entorno)


def origenes_cors(debug, entorno=None):
    return lista_desde_entorno('DJANGO_CORS_ALLOWED_ORIGINS', ORIGENES_DESARROLLO if debug else (), entorno)


def origenes_csrf(debug, entorno=None):
    return lista_desde_entorno('DJANGO_CSRF_TRUSTED_ORIGINS', ORIGENES_DESARROLLO if debug else (), entorno)
