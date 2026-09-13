from django.shortcuts import render
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Unidad
from .serializer import UnidadSerializer
from .helpers import (
    es_admin,
    es_profesor,
    es_estudiante,
    obtener_persona_y_rol,
    verificar_profesor_materia,
)

class UnidadViewSet(viewsets.ModelViewSet):
    serializer_class = UnidadSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['orden', 'numero']
    ordering = ['orden', 'numero']

    def get_queryset(self):
        user = self.request.user
        persona, _ = obtener_persona_y_rol(user)
        materia_id = self.request.query_params.get('materia')

        qs = Unidad.objects.filter(fecha_baja__isnull=True).select_related('materia')

        if materia_id:
            qs = qs.filter(materia_id=materia_id)

        if es_admin(user):
            return qs
        if es_profesor(user):
            return qs.filter(materia__profesor=persona)
        if es_estudiante(user):
            return qs.filter(materia__estudiantes=persona)

        return Unidad.objects.none()

    def perform_create(self, serializer):
        verificar_profesor_materia(self.request.user, serializer.validated_data['materia'])
        serializer.save()

    def perform_update(self, serializer):
        verificar_profesor_materia(self.request.user, self.get_object().materia)
        serializer.save()

    def perform_destroy(self, instance):
        verificar_profesor_materia(self.request.user, instance.materia)
        instance.soft_delete()

    @action(detail=True, methods=['post'], url_path='restaurar')
    def restaurar(self, request, pk=None):
        #Para restaurar una unidad dada de baja
        unidad = Unidad.objects.filter(pk=pk, fecha_baja__isnull=False).select_related('materia').first()
        if not unidad:
            return Response({'detail': 'Unidad no encontrada'}, status=status.HTTP_404_NOT_FOUND)

        verificar_profesor_materia(request.user, unidad.materia)
        unidad.restore()
        return Response({'mensaje': f'Unidad {unidad.numero} restaurada correctamente.'}, status=status.HTTP_200_OK)


