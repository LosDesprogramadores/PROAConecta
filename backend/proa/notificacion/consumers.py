import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .tiempo_real import grupo_materia, grupo_materia_rol, grupo_rol, grupo_usuario

CODIGO_NO_AUTENTICADO = 4401


class NotificacionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.grupos = []
        user = self.scope.get('user')

        if not user or not user.is_authenticated:
            # Se acepta y se cierra para que el navegador reciba el código 4401
            await self.accept()
            await self.close(code=CODIGO_NO_AUTENTICADO)
            return

        # La pertenencia se evalúa al conectar: quien pase a BAJA sigue recibiendo eventos hasta reconectar
        # (aceptado por ahora). Los grupos los decide el servidor: el cliente nunca pide a cuáles unirse
        self.grupos = [grupo_usuario(user.pk)]
        self.grupos += [grupo_rol(rol) for rol in await self.obtener_roles_usuario(user)]
        for materia_id, rol in await self.obtener_materias_usuario(user):
            # materia_N: eventos de la materia para todos sus miembros (anuncios, mensajes);
            # materia_N_rol_X: avisos de la materia que respetan el alcance
            self.grupos += [grupo_materia(materia_id), grupo_materia_rol(materia_id, rol)]

        for grupo in self.grupos:
            await self.channel_layer.group_add(grupo, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        for grupo in self.grupos:
            await self.channel_layer.group_discard(grupo, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        # Solo se admite ping; los envíos de negocio van por REST
        try:
            mensaje = json.loads(text_data or '')
        except ValueError:
            return
        if isinstance(mensaje, dict) and mensaje.get('tipo') == 'ping':
            await self.send(text_data=json.dumps({'tipo': 'pong'}))

    async def evento(self, event):
        await self.send(text_data=json.dumps({
            'tipo': event['tipo'],
            'fecha': event['fecha'],
            'datos': event['datos'],
        }, default=str))

    async def sesion_revocada(self, event):
        # Evento interno (usuario desactivado o dado de baja): el cliente pide un ticket nuevo y el servidor lo niega
        await self.close(code=CODIGO_NO_AUTENTICADO)

    @database_sync_to_async
    def obtener_roles_usuario(self, user):
        from core.roles import ROL_ESTUDIANTE, ROL_PROFESOR, obtener_persona_y_rol

        # Solo profesores y estudiantes: el administrador ve sus avisos por su grupo personal
        _, rol = obtener_persona_y_rol(user)
        return [rol] if rol in (ROL_PROFESOR, ROL_ESTUDIANTE) else []

    @database_sync_to_async
    def obtener_materias_usuario(self, user):
        from academico.models import Materia
        from academico.selectors import materias_con_acceso
        from core.roles import ROL_ESTUDIANTE, ROL_PROFESOR, obtener_persona_y_rol

        persona, rol = obtener_persona_y_rol(user)
        # Sin rol (persona de baja o cuenta desactivada) no hay materias
        if persona is None or rol is None:
            return []

        # Titular de la cátedra o inscripción que no sea BAJA (LIBRE sigue siendo parte de la materia)
        como_titular = Materia.objects.filter(profesor=persona).values_list('id', flat=True)
        como_alumno = materias_con_acceso(persona).values_list('id', flat=True)
        titular = set(como_titular)
        pertenencias = {(m_id, ROL_PROFESOR) for m_id in titular}
        pertenencias |= {(m_id, ROL_ESTUDIANTE) for m_id in set(como_alumno) - titular}
        return sorted(pertenencias)
