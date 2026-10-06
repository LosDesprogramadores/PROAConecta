"""Bitácora de cambios de estado en la colección ``bitacora`` de MongoDB (C15, #219).

Documento: ``{fecha, tipo, actor_id, actor_rol, entidad, entidad_id, materia_id, datos}``. ``datos``
es un diccionario libre (por convención ``{"antes": {...}, "despues": {...}}``) ya limpiado de
secretos y de cuerpos de mensaje.

Política de fallos: auditar nunca rompe la operación auditada. El documento se arma al llamar (con
el actor y la hora del momento) y se inserta en ``transaction.on_commit``: si la transacción se
revierte no queda nada. Si Mongo falla se registra un warning (tipo de evento y de error, sin datos)
y se sigue.
"""
import logging
from datetime import datetime, timezone
from urllib.parse import urlencode

from django.db import transaction
from rest_framework.exceptions import ValidationError

from core.roles import obtener_persona_y_rol
from notificacion.mongo import COLECCION_BITACORA, obtener_coleccion
from usuario.models import Usuario

logger = logging.getLogger(__name__)

# OJO: la limpieza mira solo los NOMBRES de las claves, no los valores. Quien llama no debe poner
# secretos dentro de un valor (por ejemplo ``{'detalle': 'token=abc'}``): ese texto se guardaría tal cual.
# Una clave que contenga alguno de estos fragmentos no se guarda, en ningún nivel de anidamiento
FRAGMENTOS_PROHIBIDOS = ('password', 'contrasena', 'contraseña', 'clave', 'token', 'ticket', 'secret', 'cuerpo', 'authorization')

PAGE_SIZE_POR_DEFECTO = 50
PAGE_SIZE_MAXIMO = 100


def _limpiar(valor):
    if isinstance(valor, dict):
        return {
            clave: _limpiar(elemento) for clave, elemento in valor.items()
            if not any(f in str(clave).lower() for f in FRAGMENTOS_PROHIBIDOS)
        }
    if isinstance(valor, (list, tuple)):
        return [_limpiar(elemento) for elemento in valor]
    return valor


def registrar_evento(tipo, actor, entidad, datos=None, *, entidad_id=None, materia_id=None) -> None:
    """Programa el registro de un evento para después del commit. ``actor`` puede ser None (sistema)."""
    try:
        _, rol = obtener_persona_y_rol(actor) if actor is not None else (None, None)
        documento = {
            'fecha': datetime.now(timezone.utc),
            'tipo': tipo,
            'actor_id': getattr(actor, 'pk', None),
            'actor_rol': rol.upper() if rol else None,
            'entidad': entidad,
            'entidad_id': entidad_id,
            'materia_id': materia_id,
            'datos': _limpiar(datos or {}),
        }
        transaction.on_commit(lambda: _insertar(documento))
    except Exception as error:
        logger.warning('No se pudo preparar el evento de bitácora %s (%s)', tipo, type(error).__name__)


def _insertar(documento):
    try:
        obtener_coleccion(COLECCION_BITACORA).insert_one(documento)
    except Exception as error:
        logger.warning('No se pudo registrar el evento de bitácora %s (%s)', documento['tipo'], type(error).__name__)


# --- Lectura (GET /api/auditoria/eventos/) ---

def _entero(params, nombre, por_defecto=None):
    valor = params.get(nombre)
    if valor in (None, ''):
        return por_defecto
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ValidationError({nombre: ['Debe ser un número entero.']})


def _fecha(params, nombre):
    valor = params.get(nombre)
    if valor in (None, ''):
        return None
    try:
        fecha = datetime.fromisoformat(str(valor).replace('Z', '+00:00'))
    except ValueError:
        raise ValidationError({nombre: ['Debe ser una fecha ISO-8601 válida.']})
    return fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)


def _filtro(params) -> dict:
    filtro = {}
    for nombre in ('tipo', 'entidad'):
        if params.get(nombre):
            filtro[nombre] = params[nombre]
    for nombre in ('entidad_id', 'actor_id', 'materia_id'):
        valor = _entero(params, nombre)
        if valor is not None:
            filtro[nombre] = valor
    rango = {}
    desde, hasta = _fecha(params, 'desde'), _fecha(params, 'hasta')
    if desde:
        rango['$gte'] = desde
    if hasta:
        rango['$lte'] = hasta
    if rango:
        filtro['fecha'] = rango
    return filtro


def _iso(fecha) -> str:
    if fecha.tzinfo is None:  # pymongo devuelve fechas sin zona: se guardaron en UTC
        fecha = fecha.replace(tzinfo=timezone.utc)
    return fecha.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def _serializar(docs) -> list:
    actores = {
        u.pk: f'{u.persona.apellido}, {u.persona.nombre}'
        for u in Usuario.objects.filter(
            pk__in={d['actor_id'] for d in docs if d.get('actor_id') is not None}, persona__isnull=False
        ).select_related('persona')
    }
    return [{
        'id': str(d['_id']),
        'fecha': _iso(d['fecha']),
        'actor': None if d.get('actor_id') is None else {
            'id': d['actor_id'], 'nombre_completo': actores.get(d['actor_id']), 'rol': d.get('actor_rol'),
        },
        'tipo': d['tipo'],
        'entidad': d.get('entidad'),
        'entidad_id': d.get('entidad_id'),
        'materia_id': d.get('materia_id'),
        'datos': d.get('datos', {}),
    } for d in docs]


def listar(params, ruta) -> dict:
    """Eventos paginados, del más nuevo al más viejo. El ``ip`` no existe en el documento ni se devuelve."""
    filtro = _filtro(params)
    pagina = max(1, _entero(params, 'page', 1))
    tamano = max(1, min(_entero(params, 'page_size', PAGE_SIZE_POR_DEFECTO), PAGE_SIZE_MAXIMO))
    coleccion = obtener_coleccion(COLECCION_BITACORA)
    total = coleccion.count_documents(filtro)
    cursor = coleccion.find(filtro).sort([('fecha', -1), ('_id', -1)]).skip((pagina - 1) * tamano).limit(tamano)
    base = {k: v for k, v in params.items() if k != 'page'}

    def _enlace(n):
        return f'{ruta}?{urlencode({**base, "page": n})}'

    return {
        'count': total,
        'next': _enlace(pagina + 1) if pagina * tamano < total else None,
        'previous': _enlace(pagina - 1) if pagina > 1 else None,
        'results': _serializar(list(cursor)),
    }
