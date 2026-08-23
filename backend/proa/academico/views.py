from django.shortcuts import render
from rest_framework import viewsets, permissions, filters
from .models import Materia
from .serializer import MateriaSerializer

# Create your views here.

class MateriaViewSet(viewsets.ModelViewSet):
    queryset = Materia.objects.select_related('docente').all()
    serializer_class = MateriaSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['titulo', 'descripcion', 
                     'criterios_evaluacion', 'anio',
                       'curso', 'docente__nombre',
                         'docente__apellido']
    ordering_fields = ['anio', 'curso', 'titulo']