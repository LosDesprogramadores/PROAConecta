from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def health_check(request):
    return Response({"status": "ok", "message": "Backend Django conectado exitosamente"})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('usuario.urls')), 
    path('api/health/', health_check, name='health_check'),
]