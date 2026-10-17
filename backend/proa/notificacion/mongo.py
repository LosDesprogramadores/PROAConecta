import threading

import pymongo
from django.conf import settings

COLECCION_NOTIFICACION = 'notificacion'
COLECCION_MENSAJE = 'mensaje'
COLECCION_BITACORA = 'bitacora'

_cliente = None
_db = None
_candado = threading.Lock()


def obtener_db():
    # El cliente se crea en el primer uso y no al importar: así importar la app
    # no abre conexiones y los tests pueden reemplazar el cliente
    global _cliente, _db
    if _db is None:
        with _candado:
            if _db is None:
                _cliente = pymongo.MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
                _db = _cliente[settings.MONGO_DB_NAME]
    return _db


def obtener_coleccion(nombre):
    return obtener_db()[nombre]
