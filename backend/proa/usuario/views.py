from rest_framework import viewsets
from .models import Rol
from .serializers import RolSerializer

class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all()
    serializer_class = RolSerializer