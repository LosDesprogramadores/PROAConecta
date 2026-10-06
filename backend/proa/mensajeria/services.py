"""Reglas de la mensajería profesor titular <-> estudiante inscripto, por materia.

Un mensaje es válido si el remitente es el titular de la materia y el destinatario un estudiante con
inscripción vigente (toda menos BAJA; LIBRE cuenta), o al revés. No hay mensajes entre estudiantes,
y el administrador no participa ni lee mensajes privados. La autorización sale de PostgreSQL; Mongo
solo guarda los mensajes.
"""
from datetime import datetime, timezone

from django.shortcuts import get_object_or_404

from academico.models import Materia
from academico.selectors import alumnos_de_materia
from core.roles import (
    es_estudiante,
    es_profesor,
    es_profesor_de_materia,
    obtener_persona_y_rol,
    tiene_inscripcion_activa,
)
from usuario.models import Usuario

from . import repositorio
from rest_framework.exceptions import PermissionDenied

MENSAJE_PAR_NO_PERMITIDO = 'No podés enviar mensajes a este destinatario en esta materia.'
MENSAJE_SIN_ACCESO = 'No tenés acceso a los mensajes de esta materia.'


def _nombre_completo(persona) -> str:
    return f'{persona.apellido}, {persona.nombre}'


def _es_titular(usuario, materia) -> bool:
    return es_profesor(usuario) and es_profesor_de_materia(usuario, materia)


def _es_inscripto(usuario, materia) -> bool:
    persona, _ = obtener_persona_y_rol(usuario)
    return es_estudiante(usuario) and tiene_inscripcion_activa(persona, materia)


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
