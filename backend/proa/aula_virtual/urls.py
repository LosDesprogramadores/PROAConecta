from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UnidadViewSet


router = DefaultRouter()
router.register(r'unidades', UnidadViewSet, basename='unidad')

app_name = 'aula_virtual'

urlpatterns = [
    path('', include(router.urls)),
]