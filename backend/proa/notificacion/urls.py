from django.urls import path
from .views import NotificacionListCreateView, NotificacionDetailView

urlpatterns = [
    path('', NotificacionListCreateView.as_view(), name='notificacion-list-create'),
    path('<str:pk>/', NotificacionDetailView.as_view(), name='notificacion-detail'),
]