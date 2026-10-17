"""
URL configuration for proa project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
import functools

from django.conf import settings
from django.contrib import admin
from django.http import Http404
from django.urls import path, include
from core.salud import SaludView
from mensajeria.urls import destinatarios_urlpatterns
from notificacion.urls import anuncios_urlpatterns
from notificacion.views import WsTicketView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)


def _documentacion(vista):
    """Sirve la vista solo si ``DOCS_API_PUBLICAS`` está activo; si no, 404 como si la ruta no existiera.

    El setting se lee en cada pedido (no al importar el URLconf), así la ruta sigue declarada y la matriz de
    permisos la cubre en los dos modos.
    """
    @functools.wraps(vista)
    def envuelta(request, *args, **kwargs):
        if not settings.DOCS_API_PUBLICAS:
            raise Http404
        return vista(request, *args, **kwargs)

    return envuelta


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('usuario.urls')), 
    path('api/materias/', include(anuncios_urlpatterns)),
    path('api/materias/', include(destinatarios_urlpatterns)),
    path('api/mensajes/', include('mensajeria.urls')),
    path('api/auditoria/', include('auditoria.urls')),
    path('api/', include('academico.urls')),
    path('api/', include('aula_virtual.urls')),
    path('api/schema/', _documentacion(SpectacularAPIView.as_view()), name='schema'),
    path('api/schema/swagger-ui/', _documentacion(SpectacularSwaggerView.as_view(url_name='schema')), name='swagger-ui'),
    path('api/schema/redoc/', _documentacion(SpectacularRedocView.as_view(url_name='schema')), name='redoc'),
    path('api/health/', SaludView.as_view(), name='salud'),
    path('api/ws/ticket/', WsTicketView.as_view(), name='ws-ticket'),
    path('api/notificaciones/', include('notificacion.urls')),
]

# Los archivos subidos no se sirven por /media/ ni siquiera con DEBUG: se descargan con autorización
# desde /api/archivos/<tipo>/<id>/ (aula_virtual/descargas.py), que el frontend de desarrollo también usa.
