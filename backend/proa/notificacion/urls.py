from django.urls import path
from .views import AnunciosMateriaView, NotificacionDetailView, NotificacionLeerView, NotificacionListCreateView

urlpatterns = [
    path('', NotificacionListCreateView.as_view(), name='notificacion-list-create'),
    path('<str:pk>/leer/', NotificacionLeerView.as_view(), name='notificacion-leer'),
    path('<str:pk>/', NotificacionDetailView.as_view(), name='notificacion-detail'),
]

# Se montan bajo /api/materias/ (proa/urls.py): GET y POST /api/materias/<id>/anuncios/
anuncios_urlpatterns = [
    path('<int:materia_id>/anuncios/', AnunciosMateriaView.as_view(), name='materia-anuncios'),
]
