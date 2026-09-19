from django.db.models import Q
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import Unidad, Material, Actividad
from .serializer import UnidadSerializer, MaterialSerializer, ActividadSerializer
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
    ordering_fields = ['orden']
    ordering = ['orden']

    def get_queryset(self):
        user = self.request.user
        persona, _ = obtener_persona_y_rol(user)
        materia_id = self.request.query_params.get('materia')
        en_papelera = self.request.query_params.get('papelera') == 'true'

        # El estudiante no ve archivos que se dieron de baja
        if en_papelera and es_estudiante(user):
            return Unidad.objects.none()

        # Conmuta entre elementos activos o dados de baja
        qs = Unidad.objects.filter(fecha_baja__isnull=not en_papelera).select_related('materia')

        if materia_id:
            qs = qs.filter(materia_id=materia_id)

        if es_admin(user):
            return qs

        if es_profesor(user):
            return qs.filter(materia__profesor=persona)

        if es_estudiante(user):
            return qs.filter(materia__estudiantes=persona, visible=True)

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

    @action(detail=True, methods=['patch'], url_path='cambiar-visibilidad')
    def cambiar_visibilidad(self, request, pk=None):
        unidad = self.get_object()
        verificar_profesor_materia(request.user, unidad.materia)

        unidad.visible = not unidad.visible
        unidad.save(update_fields=['visible'])

        return Response({
            'id': unidad.id,
            'visible': unidad.visible,
            'mensaje': f'Unidad {"publicada" if unidad.visible else "en borrador"}.'
        })

    @action(detail=True, methods=['post'], url_path='restaurar')
    def restaurar(self, request, pk=None):
        unidad = Unidad.objects.filter(pk=pk, fecha_baja__isnull=False).select_related('materia').first()
        if not unidad:
            return Response(
                {'detail': 'Unidad no encontrada o no está dada de baja.'},
                status=status.HTTP_404_NOT_FOUND
            )

        verificar_profesor_materia(request.user, unidad.materia)
        unidad.restore()
        return Response(
            {'mensaje': f'Unidad "{unidad.titulo}" restaurada correctamente.'},
            status=status.HTTP_200_OK
        )


class MaterialViewSet(viewsets.ModelViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['titulo', 'descripcion']
    ordering_fields = ['fecha_publicacion', 'titulo']
    ordering = ['-fecha_publicacion']

    def get_queryset(self):
        usuario_actual = self.request.user
        persona, _ = obtener_persona_y_rol(usuario_actual)

        materia_id = self.request.query_params.get('materia')
        unidad_id = self.request.query_params.get('unidad')
        recurso_general = self.request.query_params.get('recurso_general')
        tipo = self.request.query_params.get('tipo')
        en_papelera = self.request.query_params.get('papelera') == 'true'

        # El estudiante jamás puede listar la papelera
        if en_papelera and es_estudiante(usuario_actual):
            return Material.objects.none()

        # Conmuta entre activos o dados de baja
        materiales = Material.objects.filter(
            fecha_baja__isnull=not en_papelera
        ).select_related('materia', 'unidad')

        if tipo:
            materiales = materiales.filter(tipo=tipo)

        if materia_id:
            materiales = materiales.filter(materia_id=materia_id)

        if unidad_id:
            materiales = materiales.filter(unidad_id=unidad_id)

        if recurso_general == 'true':
            materiales = materiales.filter(unidad__isnull=True)

        if es_admin(usuario_actual):
            return materiales

        if es_profesor(usuario_actual):
            return materiales.filter(materia__profesor=persona)

        if es_estudiante(usuario_actual):
            return materiales.filter(
                materia__estudiantes=persona,
                visible=True
            ).filter(
                Q(unidad__isnull=True) | Q(unidad__visible=True, unidad__fecha_baja__isnull=True)
            )

        return Material.objects.none()

    def perform_create(self, serializer):
        verificar_profesor_materia(self.request.user, serializer.validated_data['materia'])
        serializer.save()

    def perform_update(self, serializer):
        verificar_profesor_materia(self.request.user, self.get_object().materia)
        serializer.save()

    def perform_destroy(self, instance):
        verificar_profesor_materia(self.request.user, instance.materia)
        instance.soft_delete()

    @action(detail=True, methods=['patch'], url_path='cambiar-visibilidad')
    def cambiar_visibilidad(self, request, pk=None):
        material = self.get_object()
        verificar_profesor_materia(request.user, material.materia)

        material.visible = not material.visible
        material.save(update_fields=['visible'])

        return Response({
            'id': material.id,
            'visible': material.visible,
            'mensaje': f'Material {"visible" if material.visible else "oculto"}.'
        })

    @action(detail=True, methods=['post'], url_path='restaurar')
    def restaurar(self, request, pk=None):
        material = Material.objects.filter(pk=pk, fecha_baja__isnull=False).select_related('materia').first()
        if not material:
            return Response(
                {'detail': 'Material no encontrado o no está dado de baja.'},
                status=status.HTTP_404_NOT_FOUND
            )

        verificar_profesor_materia(request.user, material.materia)
        material.restore()
        return Response(
            {'mensaje': f'Material "{material.titulo}" restaurado.'},
            status=status.HTTP_200_OK
        )

class ActividadViewSet(viewsets.ModelViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = ActividadSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['titulo', 'descripcion']
    ordering_fields = ['fecha_creacion', 'fecha_limite', 'titulo']
    ordering = ['-fecha_creacion']

    def get_queryset(self):
        user = self.request.user
        persona, _ = obtener_persona_y_rol(user)

        materia_id = self.request.query_params.get('materia')
        estado = self.request.query_params.get('estado')

        qs = Actividad.objects.select_related('materia')

        if materia_id:
            qs = qs.filter(materia_id=materia_id)

        if es_admin(user):
            if estado:
                qs = qs.filter(estado=estado)
            return qs

        if es_profesor(user):
            qs = qs.filter(materia__profesor=persona)
            if estado:
                qs = qs.filter(estado=estado)
            return qs

        if es_estudiante(user):
            # El estudiante nunca ve borradores, sin importar qué mande por query param
            return qs.filter(
                materia__estudiantes=persona,
                estado=Actividad.EstadoActividad.PUBLICADA,
            )

        return Actividad.objects.none()

    def perform_create(self, serializer):
        verificar_profesor_materia(self.request.user, serializer.validated_data['materia'])
        serializer.save()

    def perform_update(self, serializer):
        verificar_profesor_materia(self.request.user, self.get_object().materia)
        serializer.save()

    def perform_destroy(self, instance):
        verificar_profesor_materia(self.request.user, instance.materia)
        instance.delete()

    @action(detail=True, methods=['patch'], url_path='cambiar-estado')
    def cambiar_estado(self, request, pk=None):
        actividad = self.get_object()
        verificar_profesor_materia(request.user, actividad.materia)

        nuevo_estado = (
            Actividad.EstadoActividad.BORRADOR
            if actividad.estado == Actividad.EstadoActividad.PUBLICADA
            else Actividad.EstadoActividad.PUBLICADA
        )
        actividad.estado = nuevo_estado
        actividad.save(update_fields=['estado'])

        return Response({
            'id': actividad.id,
            'estado': actividad.estado,
            'mensaje': f'Actividad {"publicada" if nuevo_estado == Actividad.EstadoActividad.PUBLICADA else "pasada a borrador"}.'
        })

    @action(detail=True, methods=['get'], url_path='entregas')
    def entregas(self, request, pk=None):
        actividad = self.get_object()
        verificar_profesor_materia(request.user, actividad.materia)

        entregas = actividad.entregas.select_related('estudiante', 'nota')
        serializer = EntregaSerializer(entregas, many=True)
        return Response(serializer.data)