"""Reglas de la mensajería profesor titular <-> estudiante inscripto, por materia.

Un mensaje es válido si el remitente es el titular de la materia y el destinatario un estudiante con
inscripción vigente (toda menos BAJA; LIBRE cuenta), o al revés. No hay mensajes entre estudiantes,
y el administrador no participa ni lee mensajes privados. La autorización sale de PostgreSQL; Mongo
solo guarda los mensajes.
"""
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from django.shortcuts import get_object_or_404

from academico.models import Inscripcion, Materia
from academico.selectors import alumnos_de_materia
from auditoria.bitacora import registrar_evento
from core.roles import (
    es_admin,
    es_estudiante,
    es_profesor,
    es_profesor_de_materia,
    obtener_persona_y_rol,
    tiene_inscripcion_activa,
)
from usuario.models import Usuario

from . import repositorio
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

MENSAJE_PAR_NO_PERMITIDO = 'No podés enviar mensajes a este destinatario en esta materia.'
MENSAJE_SIN_ACCESO = 'No tenés acceso a los mensajes de esta materia.'
MENSAJE_ADMIN = 'El administrador no puede leer mensajes privados.'
MENSAJE_CONVERSACION_NO_ENCONTRADA = 'No se encontró la conversación.'
MENSAJE_FUERA_DE_PLAZO = 'El mensaje ya no puede eliminarse.'
MENSAJE_NO_ENCONTRADO = 'Mensaje no encontrado.'

VENTANA_BORRADO = timedelta(minutes=15)
PAGE_SIZE_POR_DEFECTO = 20
PAGE_SIZE_MAXIMO = 50
LIMITE_CONVERSACION = 200


def _nombre_completo(persona) -> str:
    return f'{persona.apellido}, {persona.nombre}'


def _es_titular(usuario, materia) -> bool:
    return es_profesor(usuario) and es_profesor_de_materia(usuario, materia)


def _es_inscripto(usuario, materia) -> bool:
    persona, _ = obtener_persona_y_rol(usuario)
    return es_estudiante(usuario) and tiene_inscripcion_activa(persona, materia)


def _pertenece_a_la_materia(usuario, materia) -> bool:
    """Titular, profesor que participó en mensajes de la materia (ex-titular), o estudiante con inscripción
    en cualquier estado (BAJA incluida). Es solo para leer: enviar sigue exigiendo ``par_permitido``."""
    if _es_titular(usuario, materia):
        return True
    if es_profesor(usuario):
        return repositorio.participo_en_materia(usuario.pk, materia.pk)
    persona, _ = obtener_persona_y_rol(usuario)
    return es_estudiante(usuario) and persona is not None and Inscripcion.objects.filter(
        materia=materia, estudiante=persona,
    ).exists()


# Quien pasa a BAJA (o cuya materia se da de baja) conserva el acceso de lectura a su historial,
# como en el correo: listar, leer y marcar leído solo dependen de ser remitente o destinatario.
# Lo que se corta es enviar y recibir mensajes nuevos, y dejar de aparecer en los destinatarios.
def par_permitido(remitente, destinatario, materia) -> bool:
    if remitente.pk == destinatario.pk:
        return False
    if _es_titular(remitente, materia):
        return _es_inscripto(destinatario, materia)
    if _es_inscripto(remitente, materia):
        return _es_titular(destinatario, materia)
    return False


def enviar(remitente, materia_id, destinatario_id, asunto, cuerpo) -> dict:
    """Valida el par contra PostgreSQL y guarda el mensaje. Devuelve el documento insertado."""
    materia = get_object_or_404(Materia, pk=materia_id)  # excluye las dadas de baja
    destinatario = Usuario.objects.select_related('persona__rol').filter(pk=destinatario_id).first()
    if destinatario is None or not par_permitido(remitente, destinatario, materia):
        raise PermissionDenied(MENSAJE_PAR_NO_PERMITIDO)

    documento = {
        'materia_id': materia.pk,
        'remitente_id': remitente.pk,
        'destinatario_id': destinatario.pk,
        'asunto': asunto,
        'cuerpo': cuerpo,
        'fecha_creacion': datetime.now(timezone.utc),
        'leido': False,
        'fecha_baja': None,
    }
    repositorio.crear(documento)  # agrega _id al documento
    # Sin asunto ni cuerpo: solo quién escribió, a quién y el id del mensaje
    registrar_evento(
        'MENSAJE_ENVIADO', remitente, 'mensaje',
        {'despues': {'mensaje_id': str(documento['_id']), 'destinatario_id': destinatario.pk}},
        materia_id=materia.pk,
    )
    return documento


def destinatarios(usuario, materia) -> list:
    """A quién puede escribirle ``usuario`` en la materia (sin DNI, email ni teléfono)."""
    if _es_titular(usuario, materia):
        inscripciones = alumnos_de_materia(materia).select_related('estudiante')
        personas = [i.estudiante for i in inscripciones if i.estudiante.fecha_baja is None]
        por_persona = {
            u.persona_id: u
            for u in Usuario.objects.filter(persona__in=personas, activo=True)
        }
        return [
            {'id': por_persona[p.pk].pk, 'nombre_completo': _nombre_completo(p), 'rol': 'ESTUDIANTE'}
            for p in personas if p.pk in por_persona
        ]
    if _es_inscripto(usuario, materia):
        titular = materia.profesor
        titular_usuario = Usuario.objects.filter(persona=titular, activo=True).first() if titular else None
        if titular_usuario is None or titular.fecha_baja is not None:
            return []
        return [{'id': titular_usuario.pk, 'nombre_completo': _nombre_completo(titular), 'rol': 'PROFESOR'}]
    raise PermissionDenied(MENSAJE_SIN_ACCESO)


def _iso(fecha) -> str:
    if fecha.tzinfo is None:  # pymongo devuelve fechas sin zona: se guardaron en UTC
        fecha = fecha.replace(tzinfo=timezone.utc)
    return fecha.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def serializar(docs) -> list:
    """Formato de un elemento de ``GET /api/mensajes/`` (y del evento ``mensaje.nuevo``)."""
    materias = dict(Materia.todas.filter(
        pk__in={d['materia_id'] for d in docs}
    ).values_list('pk', 'titulo'))
    usuarios = {
        u.pk: _nombre_completo(u.persona)
        for u in Usuario.objects.filter(
            pk__in={i for d in docs for i in (d['remitente_id'], d['destinatario_id'])},
            persona__isnull=False,
        ).select_related('persona')
    }
    return [{
        'id': str(d['_id']),
        'materia': {'id': d['materia_id'], 'nombre': materias.get(d['materia_id'])},
        'remitente': {'id': d['remitente_id'], 'nombre_completo': usuarios.get(d['remitente_id'])},
        'destinatario': {'id': d['destinatario_id'], 'nombre_completo': usuarios.get(d['destinatario_id'])},
        'asunto': d['asunto'],
        'cuerpo': d['cuerpo'],
        'fecha_creacion': _iso(d['fecha_creacion']),
        'leido': d['leido'],
    } for d in docs]


def _entero(params, nombre, por_defecto=None):
    valor = params.get(nombre)
    if valor in (None, ''):
        return por_defecto
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ValidationError({nombre: ['Debe ser un número entero.']})


def listar(usuario, params, ruta) -> dict:
    """Bandeja del usuario (recibidos o enviados), paginada. El administrador no lee mensajes privados."""
    if es_admin(usuario):
        raise PermissionDenied(MENSAJE_ADMIN)
    bandeja = params.get('bandeja') or 'recibidos'
    if bandeja not in ('recibidos', 'enviados'):
        raise ValidationError({'bandeja': ['Debe ser "recibidos" o "enviados".']})
    materia_id = _entero(params, 'materia')
    pagina = max(1, _entero(params, 'page', 1))
    tamano = max(1, min(_entero(params, 'page_size', PAGE_SIZE_POR_DEFECTO), PAGE_SIZE_MAXIMO))

    if bandeja == 'enviados':
        docs, total = repositorio.listar_enviados(usuario.pk, materia_id=materia_id, pagina=pagina, tamano=tamano)
    else:
        solo_no_leidos = str(params.get('no_leidos', '')).lower() == 'true'
        docs, total = repositorio.listar_recibidos(
            usuario.pk, materia_id=materia_id, solo_no_leidos=solo_no_leidos, pagina=pagina, tamano=tamano
        )

    base = {k: v for k, v in params.items() if k != 'page'}

    def _enlace(n):
        return f'{ruta}?{urlencode({**base, "page": n})}'

    return {
        'count': total,
        'next': _enlace(pagina + 1) if pagina * tamano < total else None,
        'previous': _enlace(pagina - 1) if pagina > 1 else None,
        'results': serializar(docs),
        'no_leidos': repositorio.contar_no_leidos(usuario.pk),
    }


def _entero_obligatorio(params, nombre) -> int:
    if params.get(nombre) in (None, ''):
        raise ValidationError({nombre: ['Este parámetro es obligatorio.']})
    return _entero(params, nombre)


def conversacion(usuario, params) -> list:
    """Hilo entre ``usuario`` y la persona ``con`` en la materia, en orden cronológico.

    Como el resto de la lectura, no exige inscripción vigente: quien pasó a BAJA conserva su historial.
    Pertenece a la materia el profesor titular (o ex-titular con mensajes en ella) o quien tiene (o tuvo)
    una inscripción en cualquier estado.
    Quien no pertenece, o pide una pareja que no es profesor-estudiante, recibe el mismo 404: no se puede sondear
    materias, ids ni roles. Los mensajes de terceros nunca entran en la consulta.
    """
    if es_admin(usuario):
        raise PermissionDenied(MENSAJE_ADMIN)
    materia_id = _entero_obligatorio(params, 'materia')
    otro_id = _entero_obligatorio(params, 'con')
    materia = Materia.todas.filter(pk=materia_id).first()
    if materia is None or not _pertenece_a_la_materia(usuario, materia):
        raise NotFound(MENSAJE_CONVERSACION_NO_ENCONTRADA)
    otro = Usuario.objects.select_related('persona__rol').filter(pk=otro_id).first()
    pareja = otro is not None and (
        (es_profesor(usuario) and es_estudiante(otro)) or (es_estudiante(usuario) and es_profesor(otro))
    )
    if not pareja:
        # Misma respuesta para "no existe" y "no es una pareja válida": no se puede sondear ids ni roles
        raise NotFound(MENSAJE_CONVERSACION_NO_ENCONTRADA)
    docs = repositorio.listar_conversacion(usuario.pk, otro.pk, materia_id=materia_id, limite=LIMITE_CONVERSACION)
    return serializar(docs)


def marcar_leido(usuario, mensaje_id):
    """Marca como leído (idempotente). Devuelve el documento para avisar al remitente.

    404 si no existe o no es el destinatario: no se revela si el mensaje existe.
    """
    obj_id = repositorio.objectid_o_none(mensaje_id)
    doc = repositorio.obtener(obj_id) if obj_id else None
    if doc is None or not repositorio.marcar_leido(obj_id, usuario.pk):
        raise NotFound(MENSAJE_NO_ENCONTRADO)
    return doc


def eliminar(usuario, mensaje_id) -> None:
    """Baja lógica por el remitente, dentro de los 15 minutos del envío."""
    obj_id = repositorio.objectid_o_none(mensaje_id)
    doc = repositorio.obtener(obj_id) if obj_id else None
    if doc is None or doc['fecha_baja'] is not None or doc['remitente_id'] != usuario.pk:
        raise NotFound(MENSAJE_NO_ENCONTRADO)
    if datetime.now(timezone.utc) - _con_zona(doc['fecha_creacion']) > VENTANA_BORRADO:
        raise ValidationError({'detail': MENSAJE_FUERA_DE_PLAZO})
    repositorio.dar_de_baja(obj_id, usuario.pk)


def _con_zona(fecha):
    return fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)
