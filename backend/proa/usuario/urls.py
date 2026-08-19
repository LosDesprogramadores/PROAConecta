from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView  
from .views import RolViewSet, PersonaViewSet, AdministradorViewSet, DocenteViewSet, EstudianteViewSet, DNITokenObtainPairView, UsuarioCreateView

router = DefaultRouter()
router.register(r'roles', RolViewSet, basename='rol')
router.register(r'personas', PersonaViewSet, basename='persona')
router.register(r'administrador', AdministradorViewSet, basename='administrador')
router.register(r'docente', DocenteViewSet, basename='docente')
router.register(r'estudiante', EstudianteViewSet, basename='estudiante')
router.register(r'usuarios', UsuarioViewSet, basename='usuario')
router.register(r'usuario-roles', UsuarioRolViewSet, basename='usuario-rol')

urlpatterns = [
    path('auth/login/', DNITokenObtainPairView.as_view(), name='login'),
    path('usuarios/', UsuarioCreateView.as_view(), name='usuario-create'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include(router.urls)),
]
