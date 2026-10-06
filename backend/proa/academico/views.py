from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django.db import transaction
from aula_virtual.models import Nota
from .models import Materia, Inscripcion
from .selectors import alumnos_de_materia
from .serializer import (
    AlumnoMateriaSerializer,
    AsignarProfesorSerializer,
    DesinscribirSerializer,
    InscribirLoteSerializer,
    InscripcionSerializer,
    MateriaSerializer,
)
from aula_virtual.helpers import es_admin, verificar_profesor_materia
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from aula_virtual.services import obtener_rendimiento_estudiante, obtener_rendimiento_curso_profesor



@extend_schema_view(
    list=extend_schema(
        summary="Listar materias (con filtros de profesor y estudiante)",
        parameters=[
            OpenApiParameter(
                name='profesor',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='ID del profesor: trae materias asignadas.',
                required=False
            ),
            OpenApiParameter(
                name='excluir_profesor',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='Trae materias sin profesor asignado.',
                required=False
            ),
            OpenApiParameter(
                name='disponibles_estudiante',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='ID del estudiante: trae materias en las que NO está inscripto.',
                required=False
            ),
        ]
    )
)
class MateriaViewSet(viewsets.ModelViewSet):
    queryset = Materia.objects.select_related('profesor').all()
    serializer_class = MateriaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['titulo', 'anio', 'curso']

    @action(detail=False, methods=['post'], url_path='asignar-profesor')
    def asignar_profesor(self, request):
        entrada = AsignarProfesorSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        profesor = entrada.validated_data['profesor_id']
        materia_ids = entrada.validated_data['materia_ids']

        actualizadas = Materia.objects.filter(id__in=materia_ids).update(profesor=profesor)

        return Response({
            'mensaje': f'Se asignó el profesor a {actualizadas} materias correctamente.',
            'profesor_id': profesor.id,
            'materia_ids': materia_ids
        }, status=status.HTTP_200_OK)

    def get_queryset(self):
        queryset = super().get_queryset()      
        profesor_id = self.request.query_params.get('profesor')
        excluir_profesor = self.request.query_params.get('excluir_profesor')
        disponibles_estudiante = self.request.query_params.get('disponibles_estudiante')

        if profesor_id:
            queryset = queryset.filter(profesor_id=profesor_id)

        if excluir_profesor:
            queryset = queryset.filter(profesor__isnull=True)

        if disponibles_estudiante:
            # Disponible = sin inscripción vigente: una BAJA se puede volver a inscribir
            vigentes = Inscripcion.objects.filter(estudiante_id=disponibles_estudiante).exclude(
                estado=Inscripcion.EstadoInscripcion.BAJA
            )
            queryset = queryset.exclude(id__in=vigentes.values('materia_id'))

        return queryset
    
    @action(detail=True, methods=['patch'], url_path='desasignar-profesor')
    def desasignar_profesor(self, request, pk=None):
        try:
            materia = self.get_object()
            materia.profesor = None
            materia.save()
            return Response(
                {'detail': 'Materia desasignada correctamente.'}, 
                status=status.HTTP_200_OK
            )
        except Materia.DoesNotExist:
            return Response(
                {'detail': 'Materia no encontrada.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
    @action(detail=True, methods=['get'], url_path='mi-rendimiento')
    def mi_rendimiento(self, request, pk=None):
        # Dashboard Estudiante

        materia = self.get_object()
        data = obtener_rendimiento_estudiante(request.user, materia)
        return Response(data, status=status.HTTP_200_OK)

        # Dash Profesor
    @action(detail=True, methods=['get'], url_path='rendimiento-curso')
    def rendimiento_curso(self, request, pk=None):

        materia = self.get_object()
        data = obtener_rendimiento_curso_profesor(request.user, materia)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='alumnos')
    def alumnos(self, request, pk=None):
        materia = self.get_object()
        # Solo el administrador o el profesor titular conocen el listado
        verificar_profesor_materia(request.user, materia)

        estado = request.query_params.get('estado')
        if estado and estado not in Inscripcion.EstadoInscripcion.values:
            raise ValidationError({'estado': f'Estado inválido. Valores permitidos: {", ".join(Inscripcion.EstadoInscripcion.values)}.'})

        inscripciones = alumnos_de_materia(materia, estado=estado, search=request.query_params.get('search'))
        return Response(AlumnoMateriaSerializer(inscripciones, many=True).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='por-estudiante/(?P<estudiante_id>[^/.]+)')
    def materias_por_estudiante(self, request, estudiante_id=None):
        materias_activas_ids = Inscripcion.objects.filter(
            estudiante_id=estudiante_id
        ).exclude(
            estado=Inscripcion.EstadoInscripcion.BAJA
        ).values_list('materia_id', flat=True)

        materias = Materia.objects.filter(id__in=materias_activas_ids)
        
        serializer = self.get_serializer(materias, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class InscripcionViewSet(viewsets.ModelViewSet):
    queryset = Inscripcion.objects.select_related('materia', 'estudiante__rol').all()
    serializer_class = InscripcionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['fecha_inscripcion', 'estado']

    def get_queryset(self):
        queryset = super().get_queryset()
        # Los listados no muestran las bajas: la materia ya no es del estudiante. Solo un
        # administrador puede pedirlas con ?incluir_baja=true
        if self.action == 'list' and not (
            self.request.query_params.get('incluir_baja') == 'true' and es_admin(self.request.user)
        ):
            queryset = queryset.exclude(estado=Inscripcion.EstadoInscripcion.BAJA)
        materia_id = self.request.query_params.get('materia')
        estudiante_id = self.request.query_params.get('estudiante')

        if materia_id:
            queryset = queryset.filter(materia_id=materia_id)
        if estudiante_id:
            queryset = queryset.filter(estudiante_id=estudiante_id)

        return queryset

    @action(detail=False, methods=['post'], url_path='inscribir')
    def inscribir_lote(self, request):
        entrada = InscribirLoteSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        estudiante_id = entrada.validated_data['estudiante_id'].id
        materia_ids = entrada.validated_data['materia_ids']

        inscripciones_creadas = []
        with transaction.atomic():
            for m_id in materia_ids:
                obj, created = Inscripcion.objects.get_or_create(
                    estudiante_id=estudiante_id,
                    materia_id=m_id,
                    defaults={'estado': Inscripcion.EstadoInscripcion.CURSANDO}
                )
                if not created and obj.estado == Inscripcion.EstadoInscripcion.BAJA:
                    # Se reactiva la misma fila: no se duplica la inscripción
                    obj.estado = Inscripcion.EstadoInscripcion.CURSANDO
                    obj.save(update_fields=['estado'])
                    created = True
                if created:
                    inscripciones_creadas.append(obj)

        return Response({
            'mensaje': f'Se inscribió al alumno en {len(inscripciones_creadas)} materias.',
            'estudiante_id': estudiante_id,
            'cantidad': len(inscripciones_creadas)
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='desinscribir')
    def desinscribir_estudiante(self, request):
        entrada = DesinscribirSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        estudiante_id = entrada.validated_data['estudiante_id'].id
        materia_id = entrada.validated_data['materia_id'].id

        tiene_notas = Nota.objects.filter(
            entrega__estudiante_id=estudiante_id,
            entrega__actividad__materia_id=materia_id
        ).exists()

        if tiene_notas:
            return Response(
                {"detail": "No se puede desinscribir al estudiante porque ya tiene notas cargadas en esta materia."},
                status=status.HTTP_400_BAD_REQUEST
            )

        inscripcion = Inscripcion.objects.filter(
            estudiante_id=estudiante_id,
            materia_id=materia_id
        ).exclude(estado=Inscripcion.EstadoInscripcion.BAJA).first()

        if inscripcion:
            # La baja conserva la fila: el historial y las notas no se pierden
            inscripcion.estado = Inscripcion.EstadoInscripcion.BAJA
            inscripcion.save(update_fields=['estado'])
            return Response({"message": "Estudiante desinscripto correctamente."}, status=status.HTTP_200_OK)

        return Response({"detail": "No se encontró la inscripción para este estudiante."}, status=status.HTTP_404_NOT_FOUND)