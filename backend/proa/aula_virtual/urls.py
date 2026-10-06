from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .descargas import DescargaArchivoView
from .views import UnidadViewSet, MaterialViewSet, ActividadViewSet, EntregaViewSet


router = DefaultRouter()
router.register(r'unidades', UnidadViewSet, basename='unidad')
router.register(r'materiales', MaterialViewSet, basename='material')
router.register(r'actividades', ActividadViewSet, basename='actividad')
router.register(r'entregas', EntregaViewSet, basename='entrega')

app_name = 'aula_virtual'

urlpatterns = [
    path('archivos/<str:tipo>/<int:pk>/', DescargaArchivoView.as_view(), name='descarga-archivo'),
    path('', include(router.urls)),
]