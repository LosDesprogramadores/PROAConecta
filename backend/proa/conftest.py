import importlib
import os
import sys

import mongomock
import pymongo
import pytest
from rest_framework.test import APIClient

# MongoDB: proa/__init__.py importa mongo_client, que crea un MongoClient y hace ping al
# importarse. pytest-django importa la configuración (y con ella el paquete proa) ANTES de
# cargar este archivo, así que mongo_client ya se importó, sin URI y con db = None.
# Se reemplaza el cliente por mongomock, se fuerza la URI (un .env real nunca debe apuntar
# a Atlas) y se recarga mongo_client para que quede con una base en memoria.
# Esto no toca mongo_client.py. El parche debe correr antes que cualquier otro import de la app
os.environ['DATABASE_URL_MONGODB'] = 'mongodb://localhost:27017'
os.environ['MONGO_DB_NAME'] = 'proa_test'
pymongo.MongoClient = mongomock.MongoClient
if 'mongo_client' in sys.modules:
    importlib.reload(sys.modules['mongo_client'])
import mongo_client  # noqa: E402

# Si el parche llegara tarde, falla acá y no usa un cliente real sin avisar
assert isinstance(mongo_client.db, mongomock.Database), 'mongo_client no quedó con mongomock'

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


# Los ids replican el orden en que se cargan los roles iniciales: aula_virtual/helpers.py
# todavía compara rol_id == 1 para detectar al administrador
@pytest.fixture
def rol_administrador(db):
    return RolFactory(nombre='Administrador', id=1)


@pytest.fixture
def rol_profesor(db):
    return RolFactory(nombre='Profesor', id=2)


@pytest.fixture
def rol_estudiante(db):
    return RolFactory(nombre='Estudiante', id=3)


# Es administrador solo por rol_id == 1 (aula_virtual/helpers.py:14), sin is_staff ni
# is_superuser, para ejercitar la misma regla que aplica el código hoy
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
