from django.db.models import Q
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from .services import calificar_o_rectificar_estudiante

from .models import Unidad, Material, Actividad, Nota, Entrega
from .serializer import UnidadSerializer, MaterialSerializer, ActividadSerializer, EntregaSerializer, NotaSerializer
from .helpers import (
    es_admin,
    es_profesor,
    es_estudiante,
    obtener_persona_y_rol,
    verificar_profesor_materia,
    validar_rango_nota,
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
        unidad_id = self.request.query_params.get('unidad')
        recurso_general = self.request.query_params.get('recurso_general')
        estado = self.request.query_params.get('estado')
        en_papelera = self.request.query_params.get('papelera') == 'true'

        if en_papelera and es_estudiante(user):
            return Actividad.objects.none()

        qs = Actividad.objects.filter(
            fecha_baja__isnull=not en_papelera
        ).select_related('materia', 'unidad')

        if materia_id:
            qs = qs.filter(materia_id=materia_id)
        if unidad_id:
            qs = qs.filter(unidad_id=unidad_id)
        if recurso_general == 'true':
            qs = qs.filter(unidad__isnull=True)

        if es_admin(user):
            return qs.filter(estado=estado) if estado else qs

        if es_profesor(user):
            qs = qs.filter(materia__profesor=persona)
            return qs.filter(estado=estado) if estado else qs

        if es_estudiante(user):
            return qs.filter(
                materia__estudiantes=persona,
                estado=Actividad.EstadoActividad.PUBLICADA,
            ).filter(
                Q(unidad__isnull=True) | Q(unidad__visible=True, unidad__fecha_baja__isnull=True)
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
        instance.soft_delete()

    @action(detail=True, methods=['post'], url_path='restaurar')
    def restaurar(self, request, pk=None):
        actividad = Actividad.objects.filter(pk=pk, fecha_baja__isnull=False).select_related('materia').first()
        if not actividad:
            return Response({'detail': 'Actividad no encontrada en papelera.'}, status=status.HTTP_404_NOT_FOUND)

        verificar_profesor_materia(request.user, actividad.materia)
        actividad.restore()
        return Response({'mensaje': f'Actividad "{actividad.titulo}" restaurada.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='cambiar-estado')
    def cambiar_estado(self, request, pk=None):
        actividad = self.get_object()
        verificar_profesor_materia(request.user, actividad.materia)

        nuevo_estado = (
            Actividad.EstadoActividad.BORRADOR
            if actividad.estado == Actividad.EstadoActividad.PUBLICADA
            else Actividad.EstadoActividad.PUBLICADA
        )

        if nuevo_estado == Actividad.EstadoActividad.PUBLICADA and not actividad.fecha_limite:
            return Response(
                {'detail': 'No se puede publicar una actividad que no tenga fecha límite asignada.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        actividad.estado = nuevo_estado
        actividad.save(update_fields=['estado'])
        return Response({'id': actividad.id, 'estado': actividad.estado})

    @action(detail=True, methods=['get'], url_path='entregas')
    def entregas(self, request, pk=None):
        actividad = self.get_object()
        verificar_profesor_materia(request.user, actividad.materia)

        entregas = actividad.entregas.filter(fecha_baja__isnull=True).select_related('estudiante', 'nota__profesor')
        serializer = EntregaSerializer(entregas, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post', 'put'], url_path='calificar-estudiante')
    def calificar_estudiante(self, request, pk=None):
        estudiante_id = request.data.get('estudiante_id')
        calificacion = request.data.get('calificacion')
        descripcion = request.data.get('descripcion', '')

        if not estudiante_id or calificacion is None:
            raise ValidationError({'detail': 'Se requieren "estudiante_id" y "calificacion".'})

        nota = calificar_o_rectificar_estudiante(
            profesor_user=request.user,
            actividad_id=pk,
            estudiante_id=estudiante_id,
            calificacion=calificacion,
            descripcion=descripcion
        )

        return Response(NotaSerializer(nota).data, status=status.HTTP_200_OK)

class EntregaViewSet(viewsets.ModelViewSet):
    serializer_class = EntregaSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        persona, _ = obtener_persona_y_rol(user)
        actividad_id = self.request.query_params.get('actividad')
        en_papelera = self.request.query_params.get('papelera') == 'true'

        if en_papelera and es_estudiante(user):
            return Entrega.objects.none()

        qs = Entrega.objects.filter(fecha_baja__isnull=not en_papelera).select_related(
            'actividad__materia', 'estudiante', 'nota__profesor'
        )

        if actividad_id:
            qs = qs.filter(actividad_id=actividad_id)

        if es_admin(user):
            return qs
        if es_profesor(user):
            return qs.filter(actividad__materia__profesor=persona)
        if es_estudiante(user):
            return qs.filter(estudiante=persona)

        return Entrega.objects.none()

    def perform_create(self, serializer):
        persona, _ = obtener_persona_y_rol(self.request.user)
        if not persona:
            raise ValidationError("Tu usuario no tiene un registro de Persona asociado.")

        actividad = serializer.validated_data['actividad']
        limite = actividad.fecha_limite
        fuera_termino = bool(limite and timezone.now() > limite)

        if fuera_termino and not actividad.permitir_entrega_tardia:
            raise ValidationError("La fecha límite venció y no se aceptan entregas tardías.")

        serializer.save(
            estudiante=persona,
            fuera_de_termino=fuera_termino,
            estado=Entrega.EstadoEntrega.ENTREGADO
        )

    def perform_update(self, serializer):
        user = self.request.user
        if es_estudiante(user):
            actividad = serializer.instance.actividad
            limite = actividad.fecha_limite
            fuera_termino = bool(limite and timezone.now() > limite)

            serializer.save(
                fecha_entrega=timezone.now(),
                fuera_de_termino=serializer.instance.fuera_de_termino or fuera_termino,
                estado=Entrega.EstadoEntrega.ENTREGADO
            )
        else:
            serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        persona, _ = obtener_persona_y_rol(user)
        if es_profesor(user):
            verificar_profesor_materia(user, instance.actividad.materia)
        elif es_estudiante(user) and instance.estudiante != persona:
            raise PermissionDenied("No puedes eliminar la entrega de otro alumno.")
        instance.soft_delete()

    @action(detail=True, methods=['post'], url_path='restaurar')
    def restaurar(self, request, pk=None):
        entrega = Entrega.objects.filter(pk=pk, fecha_baja__isnull=False).select_related('actividad__materia').first()
        if not entrega:
            return Response({'detail': 'Entrega no encontrada en papelera.'}, status=status.HTTP_404_NOT_FOUND)

        if es_profesor(request.user):
            verificar_profesor_materia(request.user, entrega.actividad.materia)
        elif not es_admin(request.user):
            raise PermissionDenied("No tienes permiso para restaurar esta entrega.")

        ya_existe_activa = Entrega.objects.filter(
            actividad=entrega.actividad,
            estudiante=entrega.estudiante,
            fecha_baja__isnull=True
        ).exists()

        if ya_existe_activa:
            return Response(
                {'detail': 'No se puede restaurar: el estudiante ya posee otra entrega activa en esta actividad.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        entrega.restore()
        return Response({'mensaje': 'Entrega restaurada correctamente.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post', 'put', 'patch'], url_path='calificar')
    def calificar(self, request, pk=None):
        """Asienta o modifica la calificación de una entrega existente."""
        entrega = self.get_object()
        verificar_profesor_materia(request.user, entrega.actividad.materia)

        nota_val = validar_rango_nota(request.data.get('calificacion'))
        descripcion = (request.data.get('descripcion') or '').strip()
        profesor, _ = obtener_persona_y_rol(request.user)

        nota, _ = Nota.objects.update_or_create(
            entrega=entrega,
            defaults={
                'calificacion': nota_val,
                'descripcion': descripcion,
                'profesor': profesor
            }
        )
        entrega.estado = Entrega.EstadoEntrega.CORREGIDO
        entrega.save(update_fields=['estado'])

        return Response(NotaSerializer(nota).data, status=status.HTTP_200_OK)