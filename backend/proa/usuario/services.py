import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from notificacion.tiempo_real import grupo_usuario

logger = logging.getLogger(__name__)


def _cerrar_sockets(usuario) -> None:
    # Los sockets abiertos no consultan el estado de la cuenta: se les avisa para que se cierren.
    # Si el layer (Redis) no responde no se rompe la operación: el socket caerá solo al reconectar
    try:
        async_to_sync(get_channel_layer().group_send)(grupo_usuario(usuario.pk), {'type': 'sesion.revocada'})
    except Exception:  # noqa: BLE001 - el aviso es de mejor esfuerzo
        logger.warning('No se pudo avisar la revocación de sesión al usuario %s', usuario.pk, exc_info=True)


def revocar_sesiones(usuario, cerrar_sockets: bool = False) -> int:
    """Pone en la blacklist todos los refresh vigentes del usuario y devuelve cuántos revocó.

    Es idempotente: los refresh que ya estaban en la blacklist no se cuentan de nuevo.
    Los access ya emitidos siguen valiendo hasta que vencen (15 min como máximo), salvo los de un
    usuario desactivado, que se rechazan por `is_active`. Con `cerrar_sockets` (desactivación o baja,
    no un simple cambio de clave) también se cierran sus WebSockets abiertos.
    """
    pendientes = OutstandingToken.objects.filter(user=usuario, blacklistedtoken__isnull=True)
    revocados = BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=token) for token in pendientes],
        ignore_conflicts=True,
    )
    if cerrar_sockets:
        _cerrar_sockets(usuario)
    return len(revocados)
