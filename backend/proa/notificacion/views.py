import logging

from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from pymongo.errors import PyMongoError
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academico.models import Materia
from core.exceptions import ErrorSerializer
from core.permissions import EsAdministrador, EsProfesorDeMateria
from core.roles import es_admin, es_estudiante, es_profesor, es_profesor_de_materia, obtener_persona_y_rol
from core.roles import tiene_inscripcion_activa

from . import services, tickets
from .serializer import AnuncioEntradaSerializer, NotificacionEntradaSerializer
from .tiempo_real import grupo_materia, publicar

logger = logging.getLogger(__name__)

SIN_SERVICIO = {"detail": "Servicio de notificaciones no disponible."}
ID_INVALIDO = {"detail": "Identificador de notificación inválido."}


def _sin_servicio():
    return Response(SIN_SERVICIO, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class NotificacionListCreateView(APIView):
    # Leer: cualquier autenticado, filtrado en el servidor. Crear: solo administrador
    def get_permissions(self):
        if self.request.method == 'POST':
            return [EsAdministrador()]
        return [IsAuthenticated()]

    def get(self, request):
        try:
            data = services.listar(request.user, request.query_params, request.path)
        except PyMongoError:
            logger.exception("Mongo no disponible al listar notificaciones")
            return _sin_servicio()
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        entrada = NotificacionEntradaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            inserted_id, doc = services.crear(request.user, entrada.validated_data)
        except PyMongoError:
            logger.exception("Mongo no disponible al crear una notificación")
            return _sin_servicio()

        # Una programada se guarda sin publicar: la publica el comando periódico cuando llega su fecha
        if not doc["push_pendiente"]:
            try:
                services.publicar_aviso(inserted_id, doc)
            except Exception:
                # La notificación ya está guardada: un fallo del tiempo real no debe devolver error
                logger.warning("No se pudo publicar la notificación %s en tiempo real", inserted_id, exc_info=True)
        return Response({
            "id": str(inserted_id),
            "mensaje": "Notificación creada con éxito."
        }, status=status.HTTP_201_CREATED)


class NotificacionDetailView(APIView):
    permission_classes = [EsAdministrador]

    def put(self, request, pk):
        obj_id = services.objectid_o_none(pk)
        if obj_id is None:
            return Response(ID_INVALIDO, status=status.HTTP_400_BAD_REQUEST)
        entrada = NotificacionEntradaSerializer(data=request.data, partial=True)
        entrada.is_valid(raise_exception=True)
        try:
            existe = services.actualizar(obj_id, entrada.validated_data)
        except PyMongoError:
            logger.exception("Mongo no disponible al actualizar una notificación")
            return _sin_servicio()
        if not existe:
            return Response({"detail": "Notificación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"detail": "Notificación actualizada correctamente."}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        obj_id = services.objectid_o_none(pk)
        if obj_id is None:
            return Response(ID_INVALIDO, status=status.HTTP_400_BAD_REQUEST)
        try:
            eliminada = services.eliminar(obj_id)
        except PyMongoError:
            logger.exception("Mongo no disponible al eliminar una notificación")
            return _sin_servicio()
        if not eliminada:
            return Response({"detail": "Notificación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"detail": "Notificación eliminada correctamente."}, status=status.HTTP_200_OK)


class NotificacionLeerView(APIView):
    """Marca un aviso como leído solo para el usuario de la sesión (idempotente)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        obj_id = services.objectid_o_none(pk)
        if obj_id is None:
            return Response(ID_INVALIDO, status=status.HTTP_400_BAD_REQUEST)
        try:
            marcada = services.marcar_leida(request.user, obj_id)
        except PyMongoError:
            logger.exception("Mongo no disponible al marcar una notificación como leída")
            return _sin_servicio()
        if not marcada:
            return Response({"detail": "Notificación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"id": str(obj_id), "leida": True}, status=status.HTTP_200_OK)


class WsTicketView(APIView):
    """Entrega un ticket de un solo uso (30 s) para abrir el WebSocket sin exponer el JWT."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({
            "ticket": tickets.emitir(request.user),
            "expira_en": tickets.TTL_TICKET_SEGUNDOS,
        }, status=status.HTTP_200_OK)


CAMPOS_ANUNCIO = {
    'id': serializers.CharField(),
    'titulo': serializers.CharField(),
    'mensaje': serializers.CharField(),
    'tipo_notificacion_codigo': serializers.CharField(),
    'alcance': serializers.CharField(),
    'materia_id': serializers.IntegerField(),
    'materia_nombre': serializers.CharField(allow_null=True),
    'autor': serializers.CharField(allow_null=True),
    'fecha_creacion': serializers.CharField(),
    'estado_vigencia': serializers.CharField(),
    'leida': serializers.BooleanField(),
}
ANUNCIO_SALIDA = inline_serializer('Anuncio', CAMPOS_ANUNCIO)
ANUNCIOS_SALIDA = inline_serializer('Anuncio', CAMPOS_ANUNCIO, many=True)


class AnunciosMateriaView(APIView):
    """Anuncios de una materia (contrato notificaciones-anuncios.md).

    GET: administrador, profesor titular o estudiante con inscripción vigente (BAJA no; LIBRE sí).
    POST: solo el profesor titular. El administrador usa ``POST /api/notificaciones/`` para los avisos
    institucionales, por eso aquí recibe 403.
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [EsProfesorDeMateria()]
        return [IsAuthenticated()]

    @extend_schema(
        summary='Anuncios de la materia',
        responses={200: ANUNCIOS_SALIDA, 403: ErrorSerializer, 404: ErrorSerializer, 503: ErrorSerializer},
    )
    def get(self, request, materia_id):
        materia = get_object_or_404(Materia, pk=materia_id)  # Materia.objects excluye las dadas de baja
        self._verificar_lectura(request.user, materia)
        params = request.query_params.copy()
        params['materia_id'] = str(materia.pk)
        params['tipo'] = 'ANUNCIO'
        try:
            data = services.listar(request.user, params, request.path)
        except PyMongoError:
            logger.exception("Mongo no disponible al listar anuncios de la materia %s", materia.pk)
            return _sin_servicio()
        return Response(data, status=status.HTTP_200_OK)

    @extend_schema(
        summary='Publicar un anuncio a los inscriptos de la materia',
        request=AnuncioEntradaSerializer,
        responses={201: ANUNCIO_SALIDA, 400: ErrorSerializer, 403: ErrorSerializer, 404: ErrorSerializer,
                   503: ErrorSerializer},
    )
    def post(self, request, materia_id):
        materia = get_object_or_404(Materia, pk=materia_id)
        if es_admin(request.user):
            raise PermissionDenied('Los avisos institucionales se publican desde las notificaciones generales.')
        self.check_object_permissions(request, materia)

        entrada = AnuncioEntradaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = {
            **entrada.validated_data,
            'tipo_notificacion_codigo': 'ANUNCIO',
            'alcance': 'ESTUDIANTES',
            'materia_id': materia.pk,
        }
        try:
            inserted_id, documento = services.crear(request.user, datos)
            # Si la relectura no lo encuentra (borrado en el medio), se responde con lo que se insertó
            anuncio = (
                services.serializar_por_id(request.user, inserted_id)
                or services.serializar_documento(request.user, documento)
            )
        except PyMongoError:
            logger.exception("Mongo no disponible al publicar un anuncio en la materia %s", materia.pk)
            return _sin_servicio()

        # Solo si la transacción se confirma; un fallo del tiempo real no desarma el alta (ya está guardado)
        transaction.on_commit(lambda: self._publicar(materia.pk, anuncio))
        return Response(anuncio, status=status.HTTP_201_CREATED)

    @staticmethod
    def _verificar_lectura(user, materia):
        if es_admin(user) or es_profesor_de_materia(user, materia):
            return
        if es_profesor(user):
            raise PermissionDenied('Solo el profesor a cargo de esta materia puede ver sus anuncios.')
        if es_estudiante(user):
            persona, _ = obtener_persona_y_rol(user)
            if tiene_inscripcion_activa(persona, materia):
                return
            raise NotFound()  # no revela que la materia existe
        raise PermissionDenied()

    @staticmethod
    def _publicar(materia_id, anuncio):
        if not anuncio:
            return
        try:
            publicar(grupo_materia(materia_id), "anuncio.creado", anuncio)
        except Exception:
            logger.warning(
                "No se pudo publicar el anuncio %s en tiempo real", anuncio.get("id"), exc_info=True
            )
