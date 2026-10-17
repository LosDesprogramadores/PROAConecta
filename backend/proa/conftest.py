import os

import mongomock
import pymongo
import pytest
from rest_framework.test import APIClient

# MongoDB: notificacion/mongo.py crea el cliente de forma perezosa con pymongo.MongoClient.
# Se reemplaza por mongomock y se fuerza la URI para que un .env real nunca apunte a Atlas
# (ya no hay conexión ni ping al importar, pero cualquier test que llegue a obtener_db()
# quedaría con una base en memoria).
os.environ['DATABASE_URL_MONGODB'] = 'mongodb://localhost:27017'
os.environ['MONGO_DB_NAME'] = 'proa_test'
pymongo.MongoClient = mongomock.MongoClient

from academico.tests.factories import InscripcionFactory, MateriaFactory  # noqa: E402
from usuario.tests.factories import RolFactory, UsuarioFactory  # noqa: E402


@pytest.fixture
def cliente_anonimo():
    return APIClient()


@pytest.fixture
def api_as():
    # Devuelve un cliente autenticado como el usuario dado, sin pasar por el login
    def _api_as(usuario):
        cliente = APIClient()
        cliente.force_authenticate(user=usuario)
        return cliente

    return _api_as


# Los roles ya existen por la migración usuario/0003_roles_iniciales (get_or_create por nombre, ids 1/2/3).
# core/roles.py resuelve el rol por nombre, así que los ids de estos fixtures no son parte del contrato
@pytest.fixture
def rol_administrador(db):
    return RolFactory(nombre='Administrador', id=1)


@pytest.fixture
def rol_profesor(db):
    return RolFactory(nombre='Profesor', id=2)


@pytest.fixture
def rol_estudiante(db):
    return RolFactory(nombre='Estudiante', id=3)


# Es administrador solo por el nombre del rol (core/roles.py), sin is_staff ni is_superuser,
# para ejercitar la misma regla que aplica el código
@pytest.fixture
def admin(rol_administrador):
    return UsuarioFactory(persona__rol=rol_administrador)


@pytest.fixture
def profesor(rol_profesor):
    return UsuarioFactory(persona__rol=rol_profesor)


@pytest.fixture
def estudiante(rol_estudiante):
    return UsuarioFactory(persona__rol=rol_estudiante)


@pytest.fixture
def materia_con_inscripcion(profesor, estudiante):
    materia = MateriaFactory(profesor=profesor.persona)
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    return materia


@pytest.fixture
def mongo_mock():
    # Base de datos en memoria, nueva en cada test
    return mongomock.MongoClient()['proa_test']


@pytest.fixture(autouse=True)
def mongo_limpio():
    # Ningún test hereda ni deja documentos en las colecciones de MongoDB (mongomock vive todo el proceso)
    from notificacion import mongo

    def vaciar():
        # Sin cliente creado no hay nada que limpiar (y test_mongo.py exige que no se cree uno de más)
        if mongo._db is None:
            return
        for nombre in (mongo.COLECCION_NOTIFICACION, mongo.COLECCION_MENSAJE, mongo.COLECCION_BITACORA):
            mongo.obtener_coleccion(nombre).delete_many({})

    vaciar()
    yield
    vaciar()


@pytest.fixture(autouse=True)
def media_temporal(settings, tmp_path):
    # Los archivos subidos en los tests nunca llegan a backend/proa/media
    settings.MEDIA_ROOT = tmp_path / 'media'
