from rest_framework import viewsets, permissions, filters, serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django.db import IntegrityError, transaction
from aula_virtual.models import Nota
from auditoria.bitacora import registrar_evento
from .models import Materia, Inscripcion
from .selectors import alumnos_de_materia, materias_con_acceso, materias_con_resumen
from .services import inscribir
from core.permissions import EsAdministrador
from core.roles import ROL_ESTUDIANTE, ROL_PROFESOR, es_admin as _es_admin, obtener_persona_y_rol
from .serializer import (
    AlumnoMateriaSerializer,
    AsignarProfesorSerializer,
    DesinscribirSerializer,
    InscribirEstudiantesSerializer,
    InscribirLoteSerializer,
    InscripcionSerializer,
    MateriaSerializer,
)
from aula_virtual.helpers import es_admin, verificar_profesor_materia
from core.exceptions import ErrorSerializer
from core.pagination import PaginacionOpcional
from core.exportaciones import exportar_tabla, formato_solicitado
from .exportaciones import exportar_boletin, exportar_rendimiento_curso
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from aula_virtual.services import obtener_rendimiento_estudiante, obtener_rendimiento_curso_profesor



MENSAJE_LOTE = inline_serializer('MensajeLote', {'mensaje': serializers.CharField()})
INSCRIPCION_ESTUDIANTES = inline_serializer('InscripcionEstudiantes', {
    'mensaje': serializers.CharField(),
    'materia_id': serializers.IntegerField(),
    'cantidad': serializers.IntegerField(help_text='Inscripciones creadas o reactivadas.'),
    'omitidos': serializers.ListField(
        child=serializers.IntegerField(), help_text='Estudiantes que ya estaban inscriptos (no BAJA).'
    ),
})


def _entero_o_400(valor, campo):
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ValidationError({campo: 'Debe ser un número entero.'})


def _alcance(user):
    # (persona, rol) con rol None para el administrador, que ve todo
    if _es_admin(user):
        return None, None
    return obtener_persona_y_rol(user)


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
    queryset = materias_con_resumen()
    serializer_class = MateriaSerializer
    pagination_class = PaginacionOpcional
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['titulo', 'anio', 'curso']
    # Las altas, ediciones, bajas y asignaciones son solo del administrador; la lectura se acota en get_queryset
    acciones_de_administrador = {
        'create', 'update', 'partial_update', 'destroy', 'asignar_profesor', 'desasignar_profesor', 'restaurar',
        'exportar',
    }

    def get_permissions(self):
        if self.action in self.acciones_de_administrador:
            return [EsAdministrador()]
        return [permissions.IsAuthenticated()]

    # Contrato explícito: profesor ajeno o estudiante reciben 403 (alumnos-materia.md) y una inscripción en BAJA
    # recibe 403 en mi-rendimiento (TSK140). El resto de las acciones de detalle responde 404 fuera de alcance
    acciones_con_403_por_contrato = {'alumnos', 'mi_rendimiento'}

    def _queryset_por_rol(self, queryset):
        if self.action in self.acciones_con_403_por_contrato:
            return queryset
        persona, rol = _alcance(self.request.user)
        if self.request.user.is_authenticated and not _es_admin(self.request.user):
            if rol == ROL_PROFESOR:
                return queryset.filter(profesor=persona)
            if rol == ROL_ESTUDIANTE:
                return queryset.filter(id__in=materias_con_acceso(persona).values('id'))
            return queryset.none()
        return queryset

    @extend_schema(request=AsignarProfesorSerializer, responses={200: MENSAJE_LOTE, 400: ErrorSerializer})
    @action(detail=False, methods=['post'], url_path='asignar-profesor')
    def asignar_profesor(self, request):
        entrada = AsignarProfesorSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        profesor = entrada.validated_data['profesor_id']
        materia_ids = entrada.validated_data['materia_ids']

        with transaction.atomic():
            titulares_previos = dict(Materia.objects.filter(id__in=materia_ids).values_list('id', 'profesor_id'))
            actualizadas = Materia.objects.filter(id__in=materia_ids).update(profesor=profesor)
            for materia_id, profesor_previo in titulares_previos.items():
                registrar_evento(
                    'PROFESOR_ASIGNADO', request.user, 'materia',
                    {'antes': {'profesor_id': profesor_previo}, 'despues': {'profesor_id': profesor.id}},
                    entidad_id=materia_id, materia_id=materia_id,
                )

        return Response({
            'mensaje': f'Se asignó el profesor a {actualizadas} materias correctamente.',
            'profesor_id': profesor.id,
            'materia_ids': materia_ids
        }, status=status.HTTP_200_OK)

    def get_queryset(self):
        if self.action == 'restaurar':
            return materias_con_resumen(en_papelera=True)
        # La papelera es del administrador: otro rol recibe una lista vacía, como en el resto de la API
        if self.action == 'list' and self.request.query_params.get('papelera') == 'true':
            if not _es_admin(self.request.user):
                return Materia.objects.none()
            return materias_con_resumen(en_papelera=True)
        queryset = self._queryset_por_rol(super().get_queryset())
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
    
    def perform_destroy(self, instance):
        # Baja lógica: unidades, materiales, actividades, entregas, notas e inscripciones se conservan
        with transaction.atomic():
            instance.soft_delete()
            registrar_evento('MATERIA_BAJA', self.request.user, 'materia', entidad_id=instance.pk, materia_id=instance.pk)

    @extend_schema(
        parameters=[OpenApiParameter('formato', str, enum=['csv', 'pdf'], description='csv (defecto) o pdf')],
        responses={200: OpenApiTypes.BINARY, 400: ErrorSerializer},
    )
    @action(detail=False, methods=['get'], url_path='exportar')
    def exportar(self, request):
        formato = formato_solicitado(request)
        # Mismos filtros y orden que el listado; total_estudiantes ya excluye la baja y cuenta LIBRE
        materias = self.filter_queryset(self.get_queryset())
        columnas = ['nombre', 'curso', 'anio', 'profesor', 'inscriptos_activos']
        filas = (
            [
                m.titulo, m.curso, m.anio,
                f'{m.profesor.apellido}, {m.profesor.nombre}' if m.profesor else '',
                m.total_estudiantes,
            ]
            for m in materias
        )
        return exportar_tabla(formato, 'materias', 'Materias', columnas, filas)

    @action(detail=True, methods=['post'], url_path='restaurar')
    def restaurar(self, request, pk=None):
        materia = self.get_object()  # solo encuentra materias dadas de baja (get_queryset)
        # Un profesor dado de baja mientras tanto no vuelve como titular
        if materia.profesor_id and materia.profesor.fecha_baja is not None:
            materia.profesor = None
            materia.save(update_fields=['profesor'])
        try:
            with transaction.atomic():
                materia.restore()
                registrar_evento(
                    'MATERIA_RESTAURADA', request.user, 'materia', entidad_id=materia.pk, materia_id=materia.pk,
                )
        except IntegrityError:
            # Mientras estuvo de baja se creó otra materia activa con el mismo título, curso y año
            raise ValidationError({'detail': 'No se puede restaurar la materia: ya existe otra materia activa con el mismo título, curso y año.'})
        return Response({'mensaje': f'Materia "{materia.titulo}" restaurada correctamente.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='desasignar-profesor')
    def desasignar_profesor(self, request, pk=None):
        try:
            materia = self.get_object()
            profesor_previo = materia.profesor_id
            with transaction.atomic():
                materia.profesor = None
                materia.save()
                if profesor_previo is not None:
                    registrar_evento(
                        'PROFESOR_DESVINCULADO', request.user, 'materia',
                        {'antes': {'profesor_id': profesor_previo}, 'despues': {'profesor_id': None}},
                        entidad_id=materia.pk, materia_id=materia.pk,
                    )
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

    @extend_schema(responses={200: OpenApiTypes.BINARY, 400: ErrorSerializer, 403: ErrorSerializer})
    @action(detail=False, methods=['get'], url_path='mi-boletin/exportar')
    def mi_boletin_exportar(self, request):
        formato = formato_solicitado(request, permitidos=('pdf',), defecto='pdf')
        persona, rol = _alcance(request.user)
        # Boletín propio: ni el administrador ni el profesor tienen uno
        if rol != ROL_ESTUDIANTE or persona is None:
            raise PermissionDenied('Solo un estudiante puede descargar su boletín.')
        materias = materias_con_acceso(persona).order_by('-anio', 'titulo', 'id')  # LIBRE cuenta, BAJA no
        rendimientos = [obtener_rendimiento_estudiante(request.user, materia) for materia in materias]
        return exportar_boletin(persona, rendimientos)

    @extend_schema(
        parameters=[OpenApiParameter('formato', str, enum=['csv', 'pdf'], description='csv (defecto) o pdf')],
        responses={200: OpenApiTypes.BINARY, 400: ErrorSerializer, 403: ErrorSerializer, 404: ErrorSerializer},
    )
    @action(detail=True, methods=['get'], url_path='rendimiento-curso/exportar')
    def rendimiento_curso_exportar(self, request, pk=None):
        formato = formato_solicitado(request)
        # Una materia ajena es 404 desde get_queryset; el estudiante inscripto la ve y verificar_profesor_materia lo corta con 403
        materia = self.get_object()
        datos = obtener_rendimiento_curso_profesor(request.user, materia)
        return exportar_rendimiento_curso(formato, materia, datos)

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
        estudiante_id = _entero_o_400(estudiante_id, 'estudiante_id')
        persona, rol = _alcance(request.user)
        if rol == ROL_ESTUDIANTE and (persona is None or persona.id != estudiante_id):
            raise PermissionDenied('Solo puedes consultar tus propias materias.')
        materias_activas_ids = Inscripcion.objects.filter(
            estudiante_id=estudiante_id
        ).exclude(
            estado=Inscripcion.EstadoInscripcion.BAJA
        ).values_list('materia_id', flat=True)

        # Dentro del alcance del rol: el profesor solo ve la intersección con sus materias
        materias = self._queryset_por_rol(materias_con_resumen()).filter(
            id__in=materias_activas_ids
        )

        serializer = self.get_serializer(materias, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class InscripcionViewSet(viewsets.ModelViewSet):
    queryset = Inscripcion.objects.select_related('materia__profesor', 'estudiante__rol').all()
    serializer_class = InscripcionSerializer
    pagination_class = PaginacionOpcional
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['fecha_inscripcion', 'estado']
    acciones_de_administrador = {
        'create', 'update', 'partial_update', 'destroy', 'inscribir_lote', 'inscribir_estudiantes',
        'desinscribir_estudiante',
    }

    def get_permissions(self):
        if self.action in self.acciones_de_administrador:
            return [EsAdministrador()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        # Las inscripciones de una materia dada de baja se conservan, pero no se muestran
        queryset = super().get_queryset().filter(materia__fecha_baja__isnull=True)
        persona, rol = _alcance(self.request.user)
        if self.request.user.is_authenticated and not _es_admin(self.request.user):
            if rol == ROL_PROFESOR:
                queryset = queryset.filter(materia__profesor=persona)
            elif rol == ROL_ESTUDIANTE:
                queryset = queryset.filter(estudiante=persona)
            else:
                queryset = queryset.none()
        # Los listados no muestran las bajas: la materia ya no es del estudiante. Solo un
        # administrador puede pedirlas con ?incluir_baja=true
        if self.action == 'list' and not (
            self.request.query_params.get('incluir_baja') == 'true' and es_admin(self.request.user)
        ):
            queryset = queryset.exclude(estado=Inscripcion.EstadoInscripcion.BAJA)
        materia_id = self.request.query_params.get('materia')
        estudiante_id = self.request.query_params.get('estudiante')

        if materia_id:
            queryset = queryset.filter(materia_id=_entero_o_400(materia_id, 'materia'))
        if estudiante_id:
            estudiante_id = _entero_o_400(estudiante_id, 'estudiante')
            if rol == ROL_ESTUDIANTE and (persona is None or persona.id != estudiante_id):
                raise PermissionDenied('Solo puedes consultar tus propias inscripciones.')
            queryset = queryset.filter(estudiante_id=estudiante_id)

        return queryset

    @extend_schema(request=InscribirLoteSerializer, responses={201: MENSAJE_LOTE, 400: ErrorSerializer})
    @action(detail=False, methods=['post'], url_path='inscribir')
    def inscribir_lote(self, request):
        entrada = InscribirLoteSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        estudiante_id = entrada.validated_data['estudiante_id'].id
        materia_ids = entrada.validated_data['materia_ids']

        creadas, _ = inscribir(request.user, [(estudiante_id, m_id) for m_id in materia_ids])

        return Response({
            'mensaje': f'Se inscribió al alumno en {len(creadas)} materias.',
            'estudiante_id': estudiante_id,
            'cantidad': len(creadas)
        }, status=status.HTTP_201_CREATED)

    @extend_schema(request=InscribirEstudiantesSerializer, responses={201: INSCRIPCION_ESTUDIANTES, 400: ErrorSerializer})
    @action(detail=False, methods=['post'], url_path='inscribir-estudiantes')
    def inscribir_estudiantes(self, request):
        entrada = InscribirEstudiantesSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        materia = entrada.validated_data['materia_id']
        estudiante_ids = entrada.validated_data['estudiante_ids']

        creadas, omitidos = inscribir(request.user, [(e, materia.id) for e in estudiante_ids])

        return Response({
            'mensaje': f'Se inscribió a {len(creadas)} estudiantes en la materia.',
            'materia_id': materia.id,
            'cantidad': len(creadas),
            'omitidos': [estudiante_id for estudiante_id, _ in omitidos],
        }, status=status.HTTP_201_CREATED)

    @extend_schema(request=DesinscribirSerializer, responses={200: MENSAJE_LOTE, 400: ErrorSerializer, 404: ErrorSerializer})
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
            estado_previo = inscripcion.estado
            with transaction.atomic():
                inscripcion.estado = Inscripcion.EstadoInscripcion.BAJA
                inscripcion.save(update_fields=['estado'])
                registrar_evento(
                    'INSCRIPCION_BAJA', request.user, 'inscripcion',
                    {'antes': {'estado': estado_previo, 'estudiante_id': estudiante_id},
                     'despues': {'estado': inscripcion.estado, 'estudiante_id': estudiante_id}},
                    entidad_id=inscripcion.pk, materia_id=materia_id,
                )
            return Response({"mensaje": "Estudiante desinscripto correctamente."}, status=status.HTTP_200_OK)

        return Response({"detail": "No se encontró la inscripción para este estudiante."}, status=status.HTTP_404_NOT_FOUND)