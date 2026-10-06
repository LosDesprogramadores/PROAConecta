import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class NotificacionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            # Se acepta y se cierra para que el navegador reciba el código 4401
            await self.accept()
            await self.close(code=4401)
            return

        self.room_group_name = "notificaciones_globales"
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        self.user = self.scope.get("user")
        self.grupos_materias = []

        if self.user and self.user.is_authenticated:
            materias_ids = await self.obtener_materias_usuario(self.user)
            
            self.grupos_materias = [f"materia_{str(m_id)}" for m_id in materias_ids]

            for grupo in self.grupos_materias:
                await self.channel_layer.group_add(grupo, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        if not hasattr(self, "room_group_name"):
            return
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        for grupo in self.grupos_materias:
            await self.channel_layer.group_discard(grupo, self.channel_name)

    async def enviar_notificacion(self, event):
        notificacion = event["notificacion"]
        await self.send(text_data=json.dumps({
            "notificacion": notificacion
        }))

    @database_sync_to_async
    def obtener_materias_usuario(self, user):
        try:
             return []
        except Exception as e:
            print(f"Error obteniendo materias para el socket: {e}")
            return []