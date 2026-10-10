from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone


def grupo_usuario(usuario_id) -> str:
    return f'usuario_{int(usuario_id)}'


def grupo_materia(materia_id) -> str:
    return f'materia_{int(materia_id)}'


def grupo_materia_rol(materia_id, rol: str) -> str:
    # Los avisos de materia respetan el alcance: cada rol de la materia tiene su propio grupo
    return f'materia_{int(materia_id)}_rol_{rol.upper()}'


def grupo_rol(rol: str) -> str:
    return f'rol_{rol.upper()}'


def publicar(grupo: str, tipo: str, datos: dict) -> None:
    """Envía un evento ``{tipo, fecha, datos}`` a todos los sockets del grupo.

    Se llama desde código síncrono (vistas) después de persistir; el consumer lo reenvía tal cual.
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        grupo,
        {
            'type': 'evento',
            'tipo': tipo,
            'fecha': timezone.now().isoformat().replace('+00:00', 'Z'),
            'datos': datos,
        },
    )
