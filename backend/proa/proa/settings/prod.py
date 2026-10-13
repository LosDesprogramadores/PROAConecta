"""Producción: DEBUG apagado, clave secreta obligatoria y hosts/orígenes siempre desde el entorno.

Se activa con ``DJANGO_SETTINGS_MODULE=proa.settings.prod``. Variables obligatorias: ``DJANGO_SECRET_KEY`` y
``DJANGO_ALLOWED_HOSTS`` (sin ellas no arranca); además ``DJANGO_CORS_ALLOWED_ORIGINS`` y ``DJANGO_CSRF_TRUSTED_ORIGINS``.

Opcionales, solo con TLS delante de nginx: ``DJANGO_SECURE_HSTS_SECONDS`` (segundos de HSTS, 0 o vacío lo apaga;
31536000 es un año) y ``DJANGO_SECURE_SSL_REDIRECT`` (``true`` redirige http a https). Sin TLS, la redirección
entra en bucle.
"""
import logging
import os

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
# HSTS y redirección a https apagados por defecto: forzarlos rompería el compose local (http en :80).
# Se activan en el entorno de producción real, donde el proxy ya envía X-Forwarded-Proto
_hsts = os.environ.get('DJANGO_SECURE_HSTS_SECONDS', '').strip() or '0'
if not _hsts.isdigit():
    raise ImproperlyConfigured('DJANGO_SECURE_HSTS_SECONDS debe ser un número entero de segundos (0 para desactivar).')
SECURE_HSTS_SECONDS = int(_hsts)
SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SECURE_SSL_REDIRECT', '').strip().lower() in ('1', 'true', 'yes')
# El healthcheck interno (compose/orquestador) llega por http sin X-Forwarded-Proto: no se redirige
SECURE_REDIRECT_EXEMPT = [r'^api/health/$']

if not REDIS_URL:  # noqa: F405
    # La caché local y el channel layer en memoria no se comparten entre workers
    logging.getLogger(__name__).warning(
        "REDIS_URL no está definida con DEBUG desactivado: la caché local y el channel layer en memoria "
        "no funcionan entre varios workers, por lo que los tickets y los eventos de WebSocket pueden fallar."
    )
