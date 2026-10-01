import json
from channels.generic.websocket import AsyncWebsocketConsumer

class NotificacionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "notificaciones_globales"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def enviar_notificacion(self, event):
        notificacion = event["notificacion"]
        await self.send(text_data=json.dumps({
            "notificacion": notificacion
        }))