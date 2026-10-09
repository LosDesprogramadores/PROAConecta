"""Configuración de la suite de tests: SQLite en memoria, sin .env ni servicios externos (pytest.ini y CI)."""
from datetime import timedelta

from .base import *  # noqa: F401,F403

# Solo para tests: nunca usar estos valores fuera de la suite
SECRET_KEY = 'clave-solo-para-tests-no-usar-en-produccion-0123456789'
DEBUG = False

# Los tests corren con DEBUG False: los hosts y orígenes locales se fijan acá y no dependen del entorno
ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1']
CORS_ALLOWED_ORIGINS = ['http://localhost:4200']
CSRF_TRUSTED_ORIGINS = ['http://localhost:4200']

# Base en memoria, sin Postgres. Reemplaza por completo DATABASES de base: ni DATABASE_URL ni DB_SSL
# de un backend/.env cargado por load_dotenv llegan a la suite (NUM_PROXIES y JWT se fijan más abajo)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Hasher rápido para que crear usuarios no frene la suite
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# Sin Redis: el tiempo real se prueba sobre memoria
CHANNEL_LAYERS = {
    'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
}

# Tickets del WebSocket en memoria
CACHES = {
    'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'},
}

# Salida limpia: la suite solo muestra avisos y errores (DJANGO_LOG_LEVEL del entorno no aplica)
LOGGING = {
    **LOGGING,  # noqa: F405
    'root': {**LOGGING['root'], 'level': 'WARNING'},  # noqa: F405
    'loggers': {'django': {'level': 'WARNING'}},
}

# Los correos quedan en django.core.mail.outbox
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Los envíos en segundo plano corren en línea (un hilo suelto haría los tests no deterministas)
SEGUNDO_PLANO_SINCRONO = True

# Ninguna integración externa se llama desde los tests
DISCORD_WEBHOOK_URL = None
MONGO_URI = 'mongodb://localhost:27017'
MONGO_DB_NAME = 'proa_test'

# Throttling: tasas altas para que las suites de autenticación no se bloqueen entre sí.
# Los tests de límites las reemplazan por tasas bajas (usuario/tests/test_throttling.py)
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    'NUM_PROXIES': 1,
    'DEFAULT_THROTTLE_RATES': {
        'login': '10000/min',
        'recuperacion': '10000/hour',
        'recuperacion_confirmar': '10000/hour',
        'login_dni': '10000/hour',
        'recuperacion_email': '10000/hour',
        'mensajes': '10000/min',
    },
}

# Duración de los tokens fija, independiente de ACCESS_TOKEN_MINUTES y REFRESH_TOKEN_DAYS
SIMPLE_JWT = {
    **SIMPLE_JWT,  # noqa: F405
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}
