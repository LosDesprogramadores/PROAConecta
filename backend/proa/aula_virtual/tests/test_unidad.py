import pytest
from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from academico.tests.factories import MateriaFactory
from aula_virtual.models import Unidad
from aula_virtual.serializer import UnidadSerializer

URL = '/api/unidades/'


def datos(materia, titulo='Unidad 1', **extra):
    return {'materia': materia.id, 'titulo': titulo, 'orden': 1, **extra}


@pytest.mark.django_db
def test_doble_envio_crea_una_sola_unidad(api_as, profesor, materia_con_inscripcion):
    cliente = api_as(profesor)

    primera = cliente.post(URL, datos(materia_con_inscripcion), format='json')
    segunda = cliente.post(URL, datos(materia_con_inscripcion), format='json')

    assert primera.status_code == 201
    assert segunda.status_code == 400
    assert 'titulo' in segunda.json()
    assert Unidad.objects.filter(materia=materia_con_inscripcion).count() == 1


@pytest.mark.django_db
def test_titulo_con_espacios_en_los_bordes_se_considera_igual(api_as, profesor, materia_con_inscripcion):
    cliente = api_as(profesor)

    cliente.post(URL, datos(materia_con_inscripcion, titulo='Unidad 1'), format='json')
    respuesta = cliente.post(URL, datos(materia_con_inscripcion, titulo='  Unidad 1  '), format='json')

    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_mismo_titulo_en_otra_materia_es_valido(api_as, profesor, materia_con_inscripcion):
    otra_materia = MateriaFactory(profesor=profesor.persona, curso='2do B')
    cliente = api_as(profesor)

    primera = cliente.post(URL, datos(materia_con_inscripcion), format='json')
    segunda = cliente.post(URL, datos(otra_materia), format='json')

    assert primera.status_code == 201
    assert segunda.status_code == 201


@pytest.mark.django_db
def test_se_puede_recrear_una_unidad_dada_de_baja(api_as, profesor, materia_con_inscripcion):
    cliente = api_as(profesor)
    creada = cliente.post(URL, datos(materia_con_inscripcion), format='json').json()

    assert cliente.delete(f'{URL}{creada["id"]}/').status_code == 204
    recreada = cliente.post(URL, datos(materia_con_inscripcion), format='json')

    assert recreada.status_code == 201
    assert Unidad.objects.filter(materia=materia_con_inscripcion).count() == 2


@pytest.mark.django_db
def test_editar_una_unidad_sin_cambiar_el_titulo_es_valido(api_as, profesor, materia_con_inscripcion):
    cliente = api_as(profesor)
    creada = cliente.post(URL, datos(materia_con_inscripcion), format='json').json()

    respuesta = cliente.patch(f'{URL}{creada["id"]}/', {'descripcion': 'Nueva'}, format='json')

    assert respuesta.status_code == 200


@pytest.mark.django_db
def test_renombrar_una_unidad_con_el_titulo_de_otra_activa_devuelve_400(api_as, profesor, materia_con_inscripcion):
    cliente = api_as(profesor)
    cliente.post(URL, datos(materia_con_inscripcion, titulo='Unidad 1'), format='json')
    segunda = cliente.post(URL, datos(materia_con_inscripcion, titulo='Unidad 2'), format='json').json()

    respuesta = cliente.patch(f'{URL}{segunda["id"]}/', {'titulo': 'Unidad 1'}, format='json')

    assert respuesta.status_code == 400
    assert 'titulo' in respuesta.json()


@pytest.mark.django_db
def test_restaurar_una_unidad_que_choca_con_una_activa_devuelve_400(api_as, profesor, materia_con_inscripcion):
    cliente = api_as(profesor)
    original = cliente.post(URL, datos(materia_con_inscripcion), format='json').json()
    cliente.delete(f'{URL}{original["id"]}/')
    cliente.post(URL, datos(materia_con_inscripcion), format='json')

    respuesta = cliente.post(f'{URL}{original["id"]}/restaurar/')

    assert respuesta.status_code == 400
    assert 'detail' in respuesta.json() or 'titulo' in respuesta.json()
    assert Unidad.objects.get(pk=original['id']).fecha_baja is not None


@pytest.mark.django_db
def test_restaurar_una_unidad_sin_choque_sigue_funcionando(api_as, profesor, materia_con_inscripcion):
    cliente = api_as(profesor)
    creada = cliente.post(URL, datos(materia_con_inscripcion), format='json').json()
    cliente.delete(f'{URL}{creada["id"]}/')

    respuesta = cliente.post(f'{URL}{creada["id"]}/restaurar/')

    assert respuesta.status_code == 200
    assert Unidad.objects.get(pk=creada['id']).fecha_baja is None


@pytest.mark.django_db
def test_la_base_rechaza_duplicados_activos_aunque_se_salte_el_serializer(materia_con_inscripcion):
    Unidad.objects.create(materia=materia_con_inscripcion, titulo='Unidad 1')

    with pytest.raises(IntegrityError), transaction.atomic():
        Unidad.objects.create(materia=materia_con_inscripcion, titulo='Unidad 1')


@pytest.mark.django_db
def test_carrera_entre_validacion_y_guardado_devuelve_400_y_no_500(profesor, materia_con_inscripcion):
    # Dos envíos simultáneos pasan validate() y el segundo choca con la restricción de la base
    serializador = UnidadSerializer(data=datos(materia_con_inscripcion))
    serializador.context['request'] = type('Req', (), {'user': profesor})()
    assert serializador.is_valid(), serializador.errors
    Unidad.objects.create(materia=materia_con_inscripcion, titulo='Unidad 1')

    with pytest.raises(ValidationError) as error:
        serializador.save()

    assert 'titulo' in error.value.detail
    assert Unidad.objects.filter(materia=materia_con_inscripcion).count() == 1


@pytest.mark.django_db(transaction=True)
def test_la_migracion_aborta_y_lista_los_duplicados_activos_sin_tocar_datos():
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor

    previa = [('aula_virtual', '0001_initial')]
    destino = [('aula_virtual', '0002_unidad_titulo_unico_por_materia')]
    executor = MigrationExecutor(connection)
    executor.migrate(previa)
    try:
        apps_previas = executor.loader.project_state(previa).apps
        UnidadHistorica = apps_previas.get_model('aula_virtual', 'Unidad')
        MateriaHistorica = apps_previas.get_model('academico', 'Materia')
        materia = MateriaHistorica.objects.create(titulo='Historia', anio=2026, curso='1ro A')
        UnidadHistorica.objects.create(materia=materia, titulo='Unidad 1')
        UnidadHistorica.objects.create(materia=materia, titulo='Unidad 1')

        with pytest.raises(RuntimeError) as error:
            MigrationExecutor(connection).migrate(destino)

        assert f"materia {materia.id}: 'Unidad 1'" in str(error.value)
        assert UnidadHistorica.objects.count() == 2
    finally:
        UnidadHistorica.objects.all().delete()
        MateriaHistorica.objects.all().delete()
        MigrationExecutor(connection).migrate(destino)


@pytest.mark.django_db
def test_editar_con_put_a_un_titulo_existente_devuelve_400(api_as, profesor, materia_con_inscripcion):
    cliente = api_as(profesor)
    cliente.post(URL, datos(materia_con_inscripcion, titulo='Unidad 1'), format='json')
    segunda = cliente.post(URL, datos(materia_con_inscripcion, titulo='Unidad 2'), format='json').json()

    respuesta = cliente.put(f'{URL}{segunda["id"]}/', datos(materia_con_inscripcion, titulo='Unidad 1'), format='json')

    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_carrera_en_update_devuelve_400_y_no_500(profesor, materia_con_inscripcion):
    # Otra petición toma el título entre validate() y save() del renombrado
    segunda = Unidad.objects.create(materia=materia_con_inscripcion, titulo='Unidad 2')
    serializador = UnidadSerializer(segunda, data={'titulo': 'Unidad 1'}, partial=True)
    serializador.context['request'] = type('Req', (), {'user': profesor})()
    assert serializador.is_valid(), serializador.errors
    Unidad.objects.create(materia=materia_con_inscripcion, titulo='Unidad 1')

    with pytest.raises(ValidationError) as error:
        serializador.save()

    assert 'titulo' in error.value.detail
