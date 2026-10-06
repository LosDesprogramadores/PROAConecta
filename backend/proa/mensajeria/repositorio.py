"""Acceso a la colección ``mensaje`` de MongoDB. No conoce reglas de negocio ni permisos.

Documento: ``{materia_id, remitente_id, destinatario_id, asunto, cuerpo, fecha_creacion, leido,
fecha_baja}``. Los ids de personas son ``Usuario.pk``. Un mensaje con ``fecha_baja`` queda oculto
para ambas partes. Ninguna función registra el contenido del mensaje.
"""
from datetime import datetime, timezone

from bson.errors import InvalidId
from bson.objectid import ObjectId

from notificacion.mongo import COLECCION_MENSAJE, obtener_coleccion

ORDEN = [('fecha_creacion', -1), ('_id', -1)]


def _coleccion():
    return obtener_coleccion(COLECCION_MENSAJE)


def objectid_o_none(valor):
    try:
        return ObjectId(valor)
    except (InvalidId, TypeError):
        return None


def crear(documento: dict):
    """Inserta el documento. Devuelve ``(id, documento)``."""
    resultado = _coleccion().insert_one(documento)
    return resultado.inserted_id, documento


def obtener(obj_id):
    """El documento tal como está guardado (incluso dado de baja), o None."""
    return _coleccion().find_one({'_id': obj_id})


def _filtro(campo_usuario, usuario_id, materia_id=None, solo_no_leidos=False) -> dict:
    filtro = {campo_usuario: usuario_id, 'fecha_baja': None}
    if materia_id is not None:
        filtro['materia_id'] = materia_id
    if solo_no_leidos:
        filtro['leido'] = False
    return filtro


def _pagina(filtro, pagina, tamano):
    total = _coleccion().count_documents(filtro)
    cursor = _coleccion().find(filtro).sort(ORDEN).skip((pagina - 1) * tamano).limit(tamano)
    return list(cursor), total


def listar_recibidos(usuario_id, *, materia_id=None, solo_no_leidos=False, pagina=1, tamano=20):
    return _pagina(_filtro('destinatario_id', usuario_id, materia_id, solo_no_leidos), pagina, tamano)


def listar_enviados(usuario_id, *, materia_id=None, pagina=1, tamano=20):
    return _pagina(_filtro('remitente_id', usuario_id, materia_id), pagina, tamano)


def contar_recibidos(usuario_id) -> int:
    return _coleccion().count_documents(_filtro('destinatario_id', usuario_id))


def contar_no_leidos(usuario_id) -> int:
    return _coleccion().count_documents(_filtro('destinatario_id', usuario_id, solo_no_leidos=True))


def marcar_leido(obj_id, destinatario_id) -> bool:
    """Idempotente. False si no existe, está dado de baja o el usuario no es el destinatario."""
    filtro = {'_id': obj_id, 'destinatario_id': destinatario_id, 'fecha_baja': None}
    return _coleccion().update_one(filtro, {'$set': {'leido': True}}).matched_count > 0


def dar_de_baja(obj_id, remitente_id) -> bool:
    """Baja lógica: solo el remitente, y solo si el mensaje sigue visible."""
    filtro = {'_id': obj_id, 'remitente_id': remitente_id, 'fecha_baja': None}
    ahora = datetime.now(timezone.utc)
    return _coleccion().update_one(filtro, {'$set': {'fecha_baja': ahora}}).matched_count > 0
