"""Desarrollo local (manage.py, asgi, wsgi y docker-compose): DEBUG activo y valores locales por defecto."""
import os

from proa.entorno import clave_secreta, hosts_permitidos, origenes_cors, origenes_csrf

from .base import *  # noqa: F401,F403

DEBUG = True

# Sin DJANGO_SECRET_KEY usa la clave de desarrollo (nunca se acepta fuera de este módulo)
SECRET_KEY = clave_secreta(DEBUG)

# Hosts y orígenes locales por defecto; las variables DJANGO_* del entorno los pisan
ALLOWED_HOSTS = hosts_permitidos(DEBUG)
CORS_ALLOWED_ORIGINS = origenes_cors(DEBUG)
CSRF_TRUSTED_ORIGINS = origenes_csrf(DEBUG)

# Medición de consultas y tiempos (core/middleware.py): solo en desarrollo
MIDDLEWARE = ['core.middleware.MedicionMiddleware', *MIDDLEWARE]  # noqa: F405

# Correo por consola salvo que EMAIL_BACKEND diga otra cosa
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
