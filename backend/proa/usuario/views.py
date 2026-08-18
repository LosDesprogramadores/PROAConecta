from django.contrib.auth import authenticate, login
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Rol, Persona, Administrador, Docente, Estudiante
from .serializers import RolSerializer, PersonaSerializer, AdministradorSerializer, DocenteSerializer, EstudianteSerializer, DNITokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

class DNITokenObtainPairView(TokenObtainPairView):
    serializer_class = DNITokenObtainPairSerializer

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