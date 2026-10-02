import logging
import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

PREFIJO_WEBHOOK = 'https://discord.com/api/webhooks/'


def enviar_discord(webhook_url, titulo, descripcion='', color=0x2ECC71):
    # Solo se envía a webhooks reales de Discord
    if not webhook_url or not webhook_url.startswith(PREFIJO_WEBHOOK):
        return
    payload = {'embeds': [{'title': titulo, 'description': descripcion, 'color': color}]}
    try:
        requests.post(webhook_url, json=payload, timeout=3)
    except requests.RequestException:
        logger.exception('No se pudo enviar la notificación a Discord')


def avisar_nueva_actividad(actividad):
    # No avisar de lo que los alumnos no pueden ver
    unidad = actividad.unidad
    if actividad.fecha_baja is not None:
        return
    if unidad and (not unidad.visible or unidad.fecha_baja is not None):
        return

    materia = actividad.materia
    limite = (
        timezone.localtime(actividad.fecha_limite).strftime('%d/%m/%Y %H:%M')
        if actividad.fecha_limite else 'Sin fecha límite'
    )
    descripcion = (
        f'**Materia:** {materia.titulo}\n'
        f'**Año:** {materia.anio}\n'
        f'**Curso:** {materia.curso}\n'
        f'**Fecha límite:** {limite}'
    )
    if actividad.descripcion:
        descripcion += f'\n\n{actividad.descripcion[:300]}'

    # Canal del eje de la materia; si no tiene, el canal general
    webhook = materia.discord_webhook_url or getattr(settings, 'DISCORD_WEBHOOK_URL', None)

    enviar_discord(
        webhook,
        f'📚 {materia.titulo} ({materia.anio}) - {actividad.titulo}',
        descripcion,
    )