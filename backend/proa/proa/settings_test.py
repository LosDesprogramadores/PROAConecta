from .settings import *  # noqa: F401,F403

# Solo para tests: nunca usar estos valores fuera de la suite
SECRET_KEY = 'clave-solo-para-tests-no-usar-en-produccion-0123456789'
DEBUG = False

# Base en memoria, sin Postgres
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

# Los correos quedan en django.core.mail.outbox
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Ninguna integración externa se llama desde los tests
DISCORD_WEBHOOK_URL = None
MONGO_URI = 'mongodb://localhost:27017'
MONGO_DB_NAME = 'proa_test'

# Throttling: tasas altas para que las suites de autenticación no se bloqueen entre sí.
# Los tests de límites las reemplazan por tasas bajas (usuario/tests/test_throttling.py)
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    'DEFAULT_THROTTLE_RATES': {
        'login': '10000/min',
        'recuperacion': '10000/hour',
        'recuperacion_confirmar': '10000/hour',
        'login_dni': '10000/hour',
        'recuperacion_email': '10000/hour',
    },
}
