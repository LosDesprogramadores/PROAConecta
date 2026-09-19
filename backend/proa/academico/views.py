from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import Materia, Inscripcion
from .serializer import MateriaSerializer, InscripcionSerializer
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.types import OpenApiTypes


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
        profesor_id = request.data.get('profesor_id') or request.data.get('profesor')
        materia_ids = request.data.get('materia_ids') or request.data.get('materias', [])

        if not profesor_id:
            return Response(
                {'error': 'El campo profesor_id es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(materia_ids, list) or len(materia_ids) == 0:
            return Response(
                {'error': 'Debes enviar un array materia_ids con al menos un ID.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        Materia.objects.filter(profesor_id=profesor_id)
        actualizadas = Materia.objects.filter(id__in=materia_ids).update(profesor_id=profesor_id)

        return Response({
            'mensaje': f'Se asignó el profesor a {actualizadas} materias correctamente.',
            'profesor_id': profesor_id,
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
            queryset = queryset.exclude(inscripciones__estudiante_id=disponibles_estudiante)

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

class InscripcionViewSet(viewsets.ModelViewSet):
    queryset = Inscripcion.objects.select_related('materia', 'estudiante__rol').all()
    serializer_class = InscripcionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['fecha_inscripcion', 'estado']

    def get_queryset(self):
        queryset = super().get_queryset()
        materia_id = self.request.query_params.get('materia')
        estudiante_id = self.request.query_params.get('estudiante')

        if materia_id:
            queryset = queryset.filter(materia_id=materia_id)
        if estudiante_id:
            queryset = queryset.filter(estudiante_id=estudiante_id)

        return queryset

    @action(detail=False, methods=['post'], url_path='inscribir')
    def inscribir_lote(self, request):
        estudiante_id = request.data.get('estudiante_id')
        materia_ids = request.data.get('materia_ids', [])

        if not estudiante_id:
            return Response(
                {'error': 'El campo estudiante_id es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(materia_ids, list) or len(materia_ids) == 0:
            return Response(
                {'error': 'Debes enviar un array materia_ids con al menos un ID.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        inscripciones_creadas = []
        with transaction.atomic():
            for m_id in materia_ids:
                obj, created = Inscripcion.objects.get_or_create(
                    estudiante_id=estudiante_id,
                    materia_id=m_id,
                    defaults={'estado': Inscripcion.EstadoInscripcion.CURSANDO}
                )
                if created:
                    inscripciones_creadas.append(obj)

        return Response({
            'mensaje': f'Se inscribió al alumno en {len(inscripciones_creadas)} materias.',
            'estudiante_id': estudiante_id,
            'cantidad': len(inscripciones_creadas)
        }, status=status.HTTP_201_CREATED)