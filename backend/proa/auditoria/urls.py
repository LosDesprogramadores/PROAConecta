from django.urls import path

from .views import EventosAuditoriaView

# Se monta bajo /api/auditoria/ (proa/urls.py)
urlpatterns = [
    path('eventos/', EventosAuditoriaView.as_view(), name='auditoria-eventos'),
]
