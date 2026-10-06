"""
ASGI config for proa project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

# Los settings deben estar definidos antes de importar cualquier módulo que toque el ORM o la configuración
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proa.settings')

from django.core.asgi import get_asgi_application  # noqa: E402

# Inicializa Django (apps y modelos) antes de importar routing y middleware
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

import notificacion.routing  # noqa: E402
from notificacion.middleware import TicketAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        TicketAuthMiddleware(
            URLRouter(notificacion.routing.websocket_urlpatterns)
        )
    ),
})
