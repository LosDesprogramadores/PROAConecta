"""Migración 0005: la restricción de rango de nota es reversible y se niega a aplicarse sobre datos inválidos."""
from datetime import date
from decimal import Decimal

import pytest
from django.core.management import call_command
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor

ANTERIOR = [('aula_virtual', '0004_archivos_validados_y_con_nombre_unico')]
SIGUIENTE = [('aula_virtual', '0005_rango_de_nota_e_indices')]

pytestmark = pytest.mark.django_db(transaction=True)


def migrar(destino):
    ejecutor = MigrationExecutor(connection)
    ejecutor.migrate(destino)
    return ejecutor.loader.project_state(destino).apps


@pytest.fixture
def en_0004():
    apps = migrar(ANTERIOR)
    yield apps
    # Se deja la base en la última migración aunque el test haya fallado a mitad de camino
    migrar(ANTERIOR).get_model('aula_virtual', 'Nota').objects.all().delete()
    call_command('migrate', verbosity=0)


def crear_nota(apps, calificacion, dni='12345678'):
    Persona = apps.get_model('usuario', 'Persona')
    Materia = apps.get_model('academico', 'Materia')
    Actividad = apps.get_model('aula_virtual', 'Actividad')
    Entrega = apps.get_model('aula_virtual', 'Entrega')
    Nota = apps.get_model('aula_virtual', 'Nota')
    persona = Persona.objects.create(nombre='Ana', apellido='Paz', dni=dni, email=f'{dni}@example.com', fecha_nacimiento=date(2000, 1, 1))
    materia = Materia.objects.create(titulo=f'M{dni}', anio=2026, curso='1ro A')
    actividad = Actividad.objects.create(materia=materia, titulo='TP')
    entrega = Entrega.objects.create(actividad=actividad, estudiante=persona)
    return Nota.objects.create(entrega=entrega, calificacion=Decimal(calificacion))


def test_0005_se_revierte_y_se_vuelve_a_aplicar(en_0004):
    # En 0004 no hay restricción: una nota fuera de rango se puede guardar
    crear_nota(en_0004, '11')
    en_0004.get_model('aula_virtual', 'Nota').objects.all().delete()

    Nota = migrar(SIGUIENTE).get_model('aula_virtual', 'Nota')
    nota = crear_nota(migrar(SIGUIENTE), '5', dni='87654321')
    with pytest.raises(IntegrityError), transaction.atomic():
        Nota.objects.filter(pk=nota.pk).update(calificacion=Decimal('11'))

    migrar(ANTERIOR)  # revertir debe funcionar con datos válidos
    migrar(SIGUIENTE)


def test_0005_se_niega_a_aplicar_con_notas_fuera_de_rango(en_0004):
    crear_nota(en_0004, '11')

    with pytest.raises(RuntimeError, match=r'1 nota\(s\).*SELECT id, entrega_id, calificacion FROM nota WHERE'):
        migrar(SIGUIENTE)
