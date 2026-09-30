import logging
import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def enviar_discord(titulo, descripcion='', color=0x2ECC71):
    url = getattr(settings, 'DISCORD_WEBHOOK_URL', None)
    if not url:
        return
    payload = {'embeds': [{'title': titulo, 'description': descripcion, 'color': color}]}
    try:
        requests.post(url, json=payload, timeout=3)
    except requests.RequestException:
        logger.exception('No se pudo enviar la notificación a Discord')


def avisar_nueva_actividad(actividad):
    # No avisar de lo que los alumnos no pueden ver
    unidad = actividad.unidad
    if actividad.fecha_baja is not None:
        return
    if unidad and (not unidad.visible or unidad.fecha_baja is not None):
        return

    limite = (
        timezone.localtime(actividad.fecha_limite).strftime('%d/%m/%Y %H:%M')
        if actividad.fecha_limite else 'Sin fecha límite'
    )
    descripcion = (
        f'**Materia:** {actividad.materia.titulo}\n'
        f'**Fecha límite:** {limite}'
    )
    if actividad.descripcion:
        descripcion += f'\n\n{actividad.descripcion[:300]}'

    enviar_discord(f'📚 Nueva actividad: {actividad.titulo}', descripcion)