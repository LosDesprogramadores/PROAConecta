import importlib
from types import SimpleNamespace
from unittest import mock

import pytest
from django.apps import apps as apps_globales
from django.core.management import call_command
from django.db import connection

from usuario.models import Rol

ROLES_ESPERADOS = {1: 'Administrador', 2: 'Profesor', 3: 'Estudiante'}


def schema_editor_falso(conexion=connection):
    ejecutadas = []
    return SimpleNamespace(connection=conexion, execute=ejecutadas.append), ejecutadas


@pytest.mark.django_db
def test_migrate_crea_los_roles_iniciales_con_ids_fijos():
    # aula_virtual/helpers.py compara rol_id == 1, por eso los ids son parte del contrato
    roles = dict(Rol.objects.values_list('id', 'nombre'))

    assert roles == ROLES_ESPERADOS


@pytest.mark.django_db
def test_migracion_de_roles_es_idempotente():
    migracion = importlib.import_module('usuario.migrations.0003_roles_iniciales')

    editor, _ = schema_editor_falso()
    migracion.crear_roles(apps_globales, editor)
    migracion.crear_roles(apps_globales, editor)

    assert Rol.objects.count() == 3
    assert dict(Rol.objects.values_list('id', 'nombre')) == ROLES_ESPERADOS


@pytest.mark.django_db
def test_migracion_de_roles_respeta_roles_existentes_con_otro_id():
    # Base compartida: el rol ya existe con un id distinto, no se duplica ni se pisa el id
    Rol.objects.all().delete()
    existente = Rol.objects.create(id=10, nombre='Profesor')
    migracion = importlib.import_module('usuario.migrations.0003_roles_iniciales')

    migracion.crear_roles(apps_globales, schema_editor_falso()[0])

    assert Rol.objects.filter(nombre='Profesor').count() == 1
    assert Rol.objects.get(nombre='Profesor').id == existente.id


@pytest.mark.django_db
def test_no_hay_cambios_de_modelo_sin_migracion():
    # Equivale a `makemigrations --check --dry-run`: SystemExit(1) si faltara alguna migración
    call_command('makemigrations', check=True, dry_run=True, verbosity=0)


@pytest.mark.django_db
def test_migracion_de_roles_reinicia_la_secuencia_en_postgresql():
    # El reinicio debe salir de schema_editor.connection y ejecutarse con schema_editor.execute
    migracion = importlib.import_module('usuario.migrations.0003_roles_iniciales')
    conexion = mock.MagicMock()
    conexion.ops.sequence_reset_sql.return_value = ['SELECT setval(...)']
    editor, ejecutadas = schema_editor_falso(conexion)

    migracion.crear_roles(apps_globales, editor)

    conexion.ops.sequence_reset_sql.assert_called_once()
    assert ejecutadas == ['SELECT setval(...)']


@pytest.mark.django_db
def test_migracion_de_roles_no_ejecuta_sql_extra_en_sqlite():
    migracion = importlib.import_module('usuario.migrations.0003_roles_iniciales')
    editor, ejecutadas = schema_editor_falso()

    migracion.crear_roles(apps_globales, editor)

    assert ejecutadas == []
