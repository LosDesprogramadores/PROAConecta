"""Producción: DEBUG apagado, clave secreta obligatoria y hosts/orígenes siempre desde el entorno.

Se activa con ``DJANGO_SETTINGS_MODULE=proa.settings.prod``. Variables obligatorias: ``DJANGO_SECRET_KEY`` y
``DJANGO_ALLOWED_HOSTS`` (sin ellas no arranca); además ``DJANGO_CORS_ALLOWED_ORIGINS`` y ``DJANGO_CSRF_TRUSTED_ORIGINS``.
"""
import logging

from django.core.exceptions import ImproperlyConfigured

from proa.entorno import clave_secreta, hosts_permitidos, origenes_cors, origenes_csrf

from .base import *  # noqa: F401,F403

DEBUG = False

# Sin DJANGO_SECRET_KEY (o con una clave de desarrollo) lanza ImproperlyConfigured: la app no arranca
SECRET_KEY = clave_secreta(DEBUG)

# Sin variables las listas quedan vacías y Django rechaza todos los pedidos (falla cerrada)
ALLOWED_HOSTS = hosts_permitidos(DEBUG)
CORS_ALLOWED_ORIGINS = origenes_cors(DEBUG)
CSRF_TRUSTED_ORIGINS = origenes_csrf(DEBUG)

if not ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        'DJANGO_ALLOWED_HOSTS no está definida: con proa.settings.prod Django rechazaría todos los pedidos. '
        'Definí los hosts permitidos separados por comas en el entorno.'
    )

# El backend va detrás de nginx, que reenvía el esquema original en X-Forwarded-Proto
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
# SECURE_SSL_REDIRECT queda desactivado a propósito: forzar https rompería el compose local (http en :80)

if not REDIS_URL:  # noqa: F405
    # La caché local y el channel layer en memoria no se comparten entre workers
    logging.getLogger(__name__).warning(
        "REDIS_URL no está definida con DEBUG desactivado: la caché local y el channel layer en memoria "
        "no funcionan entre varios workers, por lo que los tickets y los eventos de WebSocket pueden fallar."
    )
