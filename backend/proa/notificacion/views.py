from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
import logging

from core.permissions import EsAdministrador
from datetime import datetime
from bson.objectid import ObjectId
from pymongo.errors import PyMongoError

from . import tickets
from .mongo import COLECCION_NOTIFICACION, obtener_coleccion
from .tiempo_real import grupo_materia, grupo_usuario, publicar

logger = logging.getLogger(__name__)


def _entero_o_none(valor):
    # '' y None significan "sin valor"; cualquier otra cosa debe ser un entero
    if valor in (None, ''):
        return None
    return int(valor)

class NotificacionListCreateView(APIView):
    # Leer: cualquier usuario autenticado. Crear: solo administrador (JM04 define las reglas finales)
    def get_permissions(self):
        if self.request.method == 'POST':
            return [EsAdministrador()]
        return [IsAuthenticated()]

    def get(self, request):
        try:
            cursor = obtener_coleccion(COLECCION_NOTIFICACION).find().sort('fecha_creacion', -1)
            data = [{
                "id": str(n["_id"]),
                "titulo": n.get('titulo', 'Aviso'),
                "mensaje": n.get('mensaje'),
                "tipo_notificacion_codigo": n.get('tipo_notificacion_codigo', 'GENERAL'),
                "alcance": n.get('alcance', 'AMBOS'),
                "fecha_desde": n.get('fecha_desde'),
                "fecha_hasta": n.get('fecha_hasta'),
                "leida": n.get('leida', False)
            } for n in cursor]
        except PyMongoError:
            return Response({"detail": "Servicio de notificaciones no disponible"},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data
        # Se validan los ids ANTES de insertar: un id inválido no puede dejar una fila guardada con un 400
        try:
            materia_id = _entero_o_none(data.get('materia_id'))
            usuario_destino_id = _entero_o_none(data.get('usuario_destino_id', request.user.id))
        except (TypeError, ValueError):
            return Response({"detail": "materia_id y usuario_destino_id deben ser enteros."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            nueva_noti = {
                "tipo_notificacion_codigo": data.get('tipo_notificacion_codigo', 'GENERAL'),
                "usuario_destino_id": usuario_destino_id,
                "usuario_origen_id": None,
                "titulo": data.get('titulo', 'Notificación General'),
                "mensaje": data.get('mensaje'),
                "leida": False,
                "fecha_creacion": datetime.utcnow(),
                "fecha_desde": data.get('fecha_desde'),
                "fecha_hasta": data.get('fecha_hasta'),
                "referencia_tipo": None,
                "referencia_id": None,
                "alcance": data.get('alcance', 'AMBOS'), 
                "materia_id": materia_id
            }
            
            result = obtener_coleccion(COLECCION_NOTIFICACION).insert_one(nueva_noti)
            notificacion = {
                "id": str(result.inserted_id),
                "titulo": nueva_noti["titulo"],
                "mensaje": nueva_noti["mensaje"],
                "tipo_notificacion_codigo": nueva_noti["tipo_notificacion_codigo"],
                "alcance": nueva_noti["alcance"],
                "fecha_desde": str(nueva_noti.get("fecha_desde", "")),
                "fecha_hasta": str(nueva_noti.get("fecha_hasta", "")),
                "materia_id": nueva_noti.get("materia_id"),
                "leida": False
            }
            # Un anuncio de materia llega a la materia; el resto, solo a su destinatario
            if materia_id is not None:
                grupo = grupo_materia(materia_id)
            else:
                grupo = grupo_usuario(usuario_destino_id)
            try:
                publicar(grupo, "notificacion.creada", notificacion)
            except Exception:
                # La notificación ya está guardada: un fallo del tiempo real no debe devolver error
                logger.warning("No se pudo publicar la notificación %s en tiempo real", notificacion["id"], exc_info=True)
            return Response({
                "id": str(result.inserted_id),
                "mensaje": "Notificación creada con éxito."
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class NotificacionDetailView(APIView):
    permission_classes = [EsAdministrador]

    def put(self, request, pk):
        try:
            obj_id = ObjectId(pk)
            data = request.data
            
            update_data = {
                "$set": {
                    "titulo": data.get('titulo'),
                    "mensaje": data.get('mensaje'),
                    "tipo_notificacion_codigo": data.get('tipo_notificacion_codigo', 'GENERAL'),
                    "alcance": data.get('alcance'),
                    "fecha_desde": data.get('fecha_desde'),
                    "fecha_hasta": data.get('fecha_hasta'),
                    "materia_id": data.get('materia_id')
                }
            }
            
            result = obtener_coleccion(COLECCION_NOTIFICACION).update_one({"_id": obj_id}, update_data)
            
            if result.matched_count == 0:
                return Response({"error": "Notificación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
            
            return Response({"detail": "Notificación actualizada correctamente."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            obj_id = ObjectId(pk)
            result = obtener_coleccion(COLECCION_NOTIFICACION).delete_one({"_id": obj_id})
            
            if result.deleted_count == 0:
                return Response({"error": "Notificación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
            
            return Response({"detail": "Notificación eliminada correctamente."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class WsTicketView(APIView):
    """Entrega un ticket de un solo uso (30 s) para abrir el WebSocket sin exponer el JWT."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({
            "ticket": tickets.emitir(request.user),
            "expira_en": tickets.TTL_TICKET_SEGUNDOS,
        }, status=status.HTTP_200_OK)
