from django.urls import path
from .views import NotificacionDetailView, NotificacionLeerView, NotificacionListCreateView

urlpatterns = [
    path('', NotificacionListCreateView.as_view(), name='notificacion-list-create'),
    path('<str:pk>/leer/', NotificacionLeerView.as_view(), name='notificacion-leer'),
    path('<str:pk>/', NotificacionDetailView.as_view(), name='notificacion-detail'),
]