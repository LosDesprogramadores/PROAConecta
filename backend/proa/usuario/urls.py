from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RolViewSet, PersonaViewSet, AdministradorViewSet, DocenteViewSet, EstudianteViewSet

router = DefaultRouter()
router.register(r'roles', RolViewSet, basename='rol')
router.register(r'personas', PersonaViewSet, basename='persona')
router.register(r'administrador', AdministradorViewSet, basename='administrador')
router.register(r'docente', DocenteViewSet, basename='docente')
router.register(r'estudiante', EstudianteViewSet, basename='estudiante')

urlpatterns = [
    path('', include(router.urls)),
]
