from rest_framework import viewsets
from .models import Rol, Persona, Administrador, Docente, Estudiante
from .serializers import RolSerializer, PersonaSerializer, AdministradorSerializer, DocenteSerializer, EstudianteSerializer

class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all()
    serializer_class = RolSerializer

class PersonaViewSet(viewsets.ModelViewSet):
    queryset = Persona.objects.all()
    serializer_class = PersonaSerializer

class AdministradorViewSet(viewsets.ModelViewSet):
    queryset = Administrador.objects.all()
    serializer_class = AdministradorSerializer


class DocenteViewSet(viewsets.ModelViewSet):
    queryset = Docente.objects.all ()
    serializer_class = DocenteSerializer

class EstudianteViewSet(viewsets.ModelViewSet):
    queryset = Estudiante.objects.all ()
    serializer_class = EstudianteSerializer