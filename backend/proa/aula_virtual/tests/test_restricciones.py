"""Rango de la nota en la base e índices de consulta (TSK178, #307)."""
from decimal import Decimal

import pytest
from django.db import IntegrityError, connection, transaction

from academico.tests.factories import MateriaFactory
from aula_virtual.models import Actividad, Entrega, Material, Nota

pytestmark = pytest.mark.django_db


@pytest.fixture
def entrega(estudiante):
    actividad = Actividad.objects.create(materia=MateriaFactory(), titulo='TP', estado=Actividad.EstadoActividad.PUBLICADA)
    return Entrega.objects.create(actividad=actividad, estudiante=estudiante.persona)


@pytest.mark.parametrize('valor', ['0', '0.99', '10.01', '10.5'])
def test_la_base_rechaza_notas_fuera_de_rango(entrega, valor):
    # bulk_create y update saltean full_clean y los validadores del serializer
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Nota.objects.bulk_create([Nota(entrega=entrega, calificacion=Decimal(valor))])


def test_la_base_rechaza_modificar_una_nota_a_un_valor_fuera_de_rango(entrega):
    Nota.objects.create(entrega=entrega, calificacion=Decimal('5'))
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Nota.objects.update(calificacion=Decimal('10.5'))


@pytest.mark.parametrize('valor', ['1', '1.00', '10', '10.00'])
def test_la_base_acepta_los_extremos(entrega, valor):
    Nota.objects.bulk_create([Nota(entrega=entrega, calificacion=Decimal(valor))])
    assert Nota.objects.get().calificacion == Decimal(valor)


@pytest.mark.parametrize('modelo, columnas', [
    (Material, ['materia_id', 'fecha_baja']),
    (Actividad, ['materia_id', 'fecha_baja']),
    (Entrega, ['actividad_id', 'fecha_baja']),
    (Entrega, ['estudiante_id', 'fecha_baja']),
])
def test_los_indices_compuestos_existen(modelo, columnas):
    with connection.cursor() as cursor:
        restricciones = connection.introspection.get_constraints(cursor, modelo._meta.db_table)
    assert any(c['index'] and not c['unique'] and c['columns'] == columnas for c in restricciones.values())
