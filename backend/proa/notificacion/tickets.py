import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache

TTL_TICKET_SEGUNDOS = 30
_PREFIJO = 'ws_ticket:'


def emitir(usuario) -> str:
    # Un solo uso y 30 s de vida: el JWT nunca viaja en la URL del socket
    ticket = str(uuid.uuid4())
    cache.set(f'{_PREFIJO}{ticket}', usuario.pk, timeout=TTL_TICKET_SEGUNDOS)
    return ticket


def canjear(ticket):
    """Devuelve el usuario dueño del ticket y lo invalida, o None si no sirve."""
    if not ticket:
        return None
    clave = f'{_PREFIJO}{ticket}'
    usuario_id = cache.get(clave)
    # delete() informa si esta llamada borró la clave: solo un canje concurrente puede ganar
    if usuario_id is None or not cache.delete(clave):
        return None
    usuario = get_user_model().objects.filter(pk=usuario_id).first()
    if usuario is None or not usuario.is_active or not getattr(usuario, 'activo', True):
        return None
    return usuario
