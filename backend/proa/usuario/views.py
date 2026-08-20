from django.contrib.auth import authenticate, login
from rest_framework import viewsets, status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Rol, Persona
from .serializers import RolSerializer, PersonaSerializer, DNITokenObtainPairSerializer, UsuarioSerializer
from rest_framework_simplejwt.views import TokenObtainPairView



class UsuarioCreateView(generics.CreateAPIView):
    serializer_class = UsuarioSerializer

class DNITokenObtainPairView(TokenObtainPairView):
    serializer_class = DNITokenObtainPairSerializer

class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all()
    serializer_class = RolSerializer

class PersonaViewSet(viewsets.ModelViewSet):
    queryset = Persona.objects.all()
    serializer_class = PersonaSerializer
