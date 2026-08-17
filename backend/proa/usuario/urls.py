from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RolViewSet, PersonaViewSet, AdministradorViewSet

router = DefaultRouter()
router.register(r'roles', RolViewSet, basename='rol')
router.register(r'personas', PersonaViewSet, basename='persona')
router.register(r'administrador', AdministradorViewSet, basename='administrador')
urlpatterns = [
    path('', include(router.urls)),
]
