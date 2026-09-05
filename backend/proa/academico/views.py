from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Materia, Inscripcion
from .serializer import MateriaSerializer, InscripcionSerializer, PersonaResumenSerializer
from usuario.models import Persona


class MateriaViewSet(viewsets.ModelViewSet):

    queryset = Materia.objects.select_related('profesor__rol').all()
    serializer_class = MateriaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['titulo', 'curso', 'profesor__nombre', 'profesor__apellido']
    ordering_fields = ['anio', 'curso', 'titulo', 'fecha_creacion']

    def get_queryset(self):
        queryset = super().get_queryset()
        anio = self.request.query_params.get('anio')
        curso = self.request.query_params.get('curso')
        profesor_id = self.request.query_params.get('profesor')

        if anio:
            queryset = queryset.filter(anio=anio)
        if curso:
            queryset = queryset.filter(curso__icontains=curso)
        if profesor_id:
            queryset = queryset.filter(profesor_id=profesor_id)

        return queryset

    #Impedir eliminación de materias si la materia tiene un profesor asignado y/o al menos un estudiante.
    def destroy(self, request, *args, **kwargs):

        materia = self.get_object()
        motivos = []

        if materia.profesor is not None:
            motivos.append("Tiene un profesor asignado")

        total_inscriptos = materia.inscripciones.count()
        if total_inscriptos > 0:
            motivos.append(f"Tiene {total_inscriptos} estudiante(s) inscripto(s).")

        if motivos:
            return Response(
                {
                    "error": "No se puede eliminar la materia.",
                    "motivos": motivos,
                    "sugerencia": "Si elimina la materia, se eliminará toda información relacionada a la misma (Notas, Estudiantes)."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().destroy(request, *args, **kwargs)


    @action(detail=True, methods=['get'], url_path='estudiantes-disponibles')
    def estudiantes_disponibles(self, request, pk=None):

        materia = self.get_object()
        inscriptos_ids = materia.inscripciones.values_list('estudiante_id', flat=True)

        disponibles = Persona.objects.filter(
            fecha_baja__isnull=True,
            rol__nombre__iexact='Estudiante'
        ).exclude(id__in=inscriptos_ids).order_by('apellido', 'nombre')

        serializer = PersonaResumenSerializer(disponibles, many=True)
        return Response(serializer.data)


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