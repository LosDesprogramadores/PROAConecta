from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser

from . import tickets


class TicketAuthMiddleware(BaseMiddleware):
    """Autentica el socket con el ticket de un solo uso de ``?ticket=``.

    Sin ticket válido deja ``scope['user']`` como anónimo; el consumer decide cerrar con 4401.
    """

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        parametros = parse_qs(scope.get('query_string', b'').decode())
        ticket = (parametros.get('ticket') or [None])[0]
        usuario = await database_sync_to_async(tickets.canjear)(ticket)
        scope['user'] = usuario or AnonymousUser()
        return await super().__call__(scope, receive, send)
