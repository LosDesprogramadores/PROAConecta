import logging

from pymongo.errors import PyMongoError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import EsAdministrador

from . import services, tickets
from .serializer import NotificacionEntradaSerializer
from .tiempo_real import grupo_materia, grupo_usuario, publicar

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

        notificacion = {
            "id": str(inserted_id),
            "titulo": doc["titulo"],
            "mensaje": doc["mensaje"],
            "tipo_notificacion_codigo": doc["tipo_notificacion_codigo"],
            "alcance": doc["alcance"],
            "fecha_desde": str(doc.get("fecha_desde") or ""),
            "fecha_hasta": str(doc.get("fecha_hasta") or ""),
            "materia_id": doc.get("materia_id"),
            "leida": False,
        }
        # Un anuncio de materia llega a la materia; el resto, solo a su destinatario
        if doc["materia_id"] is not None:
            grupo = grupo_materia(doc["materia_id"])
        else:
            grupo = grupo_usuario(doc["usuario_destino_id"])
        try:
            publicar(grupo, "notificacion.creada", notificacion)
        except Exception:
            # La notificación ya está guardada: un fallo del tiempo real no debe devolver error
            logger.warning("No se pudo publicar la notificación %s en tiempo real", notificacion["id"], exc_info=True)
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
