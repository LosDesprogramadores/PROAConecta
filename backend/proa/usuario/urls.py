from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView  
from .views import RolViewSet, PersonaViewSet, DNITokenObtainPairView, UsuarioCreateView, PerfilUsuarioView, PersonaRolView

router = DefaultRouter()
router.register(r'roles', RolViewSet, basename='rol')
router.register(r'personas', PersonaViewSet, basename='persona')



urlpatterns = [
    path('auth/login/', DNITokenObtainPairView.as_view(), name='login'),
    path('auth/me/', PerfilUsuarioView.as_view(), name='usuario-me'),
    path('usuarios/', UsuarioCreateView.as_view(), name='usuario-create'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('personas/rol/', PersonaRolView.as_view(), name='persona_por_rol'),
    path('', include(router.urls)),
]
