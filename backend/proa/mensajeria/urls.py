from django.urls import path

from .views import DestinatariosView, MensajeDetailView, MensajeLeerView, MensajeListCreateView

# Se monta bajo /api/mensajes/ (proa/urls.py)
urlpatterns = [
    path('', MensajeListCreateView.as_view(), name='mensaje-list-create'),
    path('<str:pk>/leer/', MensajeLeerView.as_view(), name='mensaje-leer'),
    path('<str:pk>/', MensajeDetailView.as_view(), name='mensaje-detail'),
]

# Se montan bajo /api/materias/ (proa/urls.py): GET /api/materias/<id>/destinatarios/
destinatarios_urlpatterns = [
    path('<int:materia_id>/destinatarios/', DestinatariosView.as_view(), name='materia-destinatarios'),
]
