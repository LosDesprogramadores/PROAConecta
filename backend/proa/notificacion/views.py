from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from datetime import datetime
from bson.objectid import ObjectId
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .mongo import notificaciones_collection

class NotificacionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if notificaciones_collection is None:
            return Response({"error": "Base de datos no conectada."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        cursor = notificaciones_collection.find().sort('fecha_creacion', -1)
        
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
        
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        if notificaciones_collection is None:
            return Response({"error": "Base de datos no conectada."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        data = request.data
        try:
            nueva_noti = {
                "tipo_notificacion_codigo": data.get('tipo_notificacion_codigo', 'GENERAL'),
                "usuario_destino_id": int(data.get('usuario_destino_id', request.user.id)),
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
                "materia_id": data.get('materia_id')
            }
            
            result = notificaciones_collection.insert_one(nueva_noti)
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                "notificaciones_globales",
                {
                    "type": "enviar_notificacion",
                    "notificacion": {
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
                }
            )
            return Response({
                "id": str(result.inserted_id),
                "mensaje": "Notificación creada con éxito."
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class NotificacionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        if notificaciones_collection is None:
            return Response({"error": "Base de datos no conectada."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
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
            
            result = notificaciones_collection.update_one({"_id": obj_id}, update_data)
            
            if result.matched_count == 0:
                return Response({"error": "Notificación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
            
            return Response({"detail": "Notificación actualizada correctamente."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if notificaciones_collection is None:
            return Response({"error": "Base de datos no conectada."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        try:
            obj_id = ObjectId(pk)
            result = notificaciones_collection.delete_one({"_id": obj_id})
            
            if result.deleted_count == 0:
                return Response({"error": "Notificación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
            
            return Response({"detail": "Notificación eliminada correctamente."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)