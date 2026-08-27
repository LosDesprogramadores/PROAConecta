from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MateriaViewSet, InscripcionViewSet

router = DefaultRouter()
router.register(r'materias', MateriaViewSet, basename='materia')
router.register(r'inscripciones', InscripcionViewSet, basename='inscripcion')

urlpatterns = [
    path('', include(router.urls)),
]