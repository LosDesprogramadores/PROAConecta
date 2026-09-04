from rest_framework.decorators import api_view
from rest_framework.response import Response


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('usuario.urls')), 
  
]