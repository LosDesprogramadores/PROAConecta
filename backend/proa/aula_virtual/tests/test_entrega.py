import pytest

from academico.tests.factories import InscripcionFactory, MateriaFactory
from aula_virtual.models import Actividad, Entrega

URL = '/api/entregas/'
MENSAJE_ACTIVIDAD_FIJA = 'No se puede cambiar la actividad de una entrega existente.'


def crear_actividad(materia, titulo='Actividad'):
    return Actividad.objects.create(materia=materia, titulo=titulo, estado=Actividad.EstadoActividad.PUBLICADA)


@pytest.fixture
def actividad(materia_con_inscripcion):
    return crear_actividad(materia_con_inscripcion)


@pytest.fixture
def entrega(actividad, estudiante):
    return Entrega.objects.create(actividad=actividad, estudiante=estudiante.persona, contenido_texto='Primera versión')


@pytest.fixture
def entrega_corregida(entrega):
    entrega.estado = Entrega.EstadoEntrega.CORREGIDO
    entrega.save(update_fields=['estado'])
    return entrega


def detalle(entrega):
    return f'{URL}{entrega.id}/'


@pytest.mark.django_db
def test_patch_con_otra_actividad_devuelve_400_y_no_la_mueve(api_as, estudiante, entrega, rol_estudiante, profesor):
    # El estudiante está inscripto en ambas materias: igual no puede mover la entrega
    otra_materia = MateriaFactory(profesor=profesor.persona, curso='2do B')
    InscripcionFactory(materia=otra_materia, estudiante=estudiante.persona)
    otra_actividad = crear_actividad(otra_materia, 'Otra')
    actividad_original = entrega.actividad_id

    respuesta = api_as(estudiante).patch(detalle(entrega), {'actividad': otra_actividad.id}, format='json')

    assert respuesta.status_code == 400
    assert MENSAJE_ACTIVIDAD_FIJA in str(respuesta.data['actividad'])
    entrega.refresh_from_db()
    assert entrega.actividad_id == actividad_original


@pytest.mark.django_db
def test_patch_con_actividad_de_una_materia_ajena_no_salta_la_verificacion_de_inscripcion(api_as, estudiante, entrega):
    ajena = crear_actividad(MateriaFactory(curso='3ro C'), 'Ajena')

    respuesta = api_as(estudiante).patch(detalle(entrega), {'actividad': ajena.id}, format='json')

    assert respuesta.status_code == 400
    assert MENSAJE_ACTIVIDAD_FIJA in str(respuesta.data['actividad'])
    entrega.refresh_from_db()
    assert entrega.actividad_id != ajena.id


@pytest.mark.django_db
def test_patch_hacia_una_actividad_con_entrega_propia_devuelve_400_y_no_500(api_as, estudiante, entrega, profesor):
    # Antes chocaba con la restricción única (actividad, estudiante) y respondía 500
    otra_materia = MateriaFactory(profesor=profesor.persona, curso='2do B')
    InscripcionFactory(materia=otra_materia, estudiante=estudiante.persona)
    otra_actividad = crear_actividad(otra_materia, 'Otra')
    Entrega.objects.create(actividad=otra_actividad, estudiante=estudiante.persona, contenido_texto='Ya entregada')

    respuesta = api_as(estudiante).patch(detalle(entrega), {'actividad': otra_actividad.id}, format='json')

    assert respuesta.status_code == 400
    assert MENSAJE_ACTIVIDAD_FIJA in str(respuesta.data['actividad'])


@pytest.mark.django_db
def test_put_con_otra_actividad_devuelve_400(api_as, estudiante, entrega, profesor):
    otra_materia = MateriaFactory(profesor=profesor.persona, curso='2do B')
    InscripcionFactory(materia=otra_materia, estudiante=estudiante.persona)
    otra_actividad = crear_actividad(otra_materia, 'Otra')

    respuesta = api_as(estudiante).put(
        detalle(entrega), {'actividad': otra_actividad.id, 'contenido_texto': 'Nuevo'}, format='json'
    )

    assert respuesta.status_code == 400
    assert 'actividad' in respuesta.data


@pytest.mark.django_db
def test_put_con_la_misma_actividad_actualiza_la_entrega(api_as, estudiante, entrega):
    respuesta = api_as(estudiante).put(
        detalle(entrega), {'actividad': entrega.actividad_id, 'contenido_texto': 'Segunda versión'}, format='json'
    )

    assert respuesta.status_code == 200
    entrega.refresh_from_db()
    assert entrega.contenido_texto == 'Segunda versión'


@pytest.mark.django_db
def test_patch_sin_actividad_actualiza_la_entrega(api_as, estudiante, entrega):
    respuesta = api_as(estudiante).patch(detalle(entrega), {'contenido_texto': 'Corregida por el alumno'}, format='json')

    assert respuesta.status_code == 200
    entrega.refresh_from_db()
    assert entrega.contenido_texto == 'Corregida por el alumno'


@pytest.mark.django_db
def test_estudiante_no_puede_borrar_una_entrega_corregida(api_as, estudiante, entrega_corregida):
    respuesta = api_as(estudiante).delete(detalle(entrega_corregida))

    assert respuesta.status_code == 403
    entrega_corregida.refresh_from_db()
    assert entrega_corregida.fecha_baja is None


@pytest.mark.django_db
def test_profesor_no_puede_borrar_una_entrega_corregida(api_as, profesor, entrega_corregida):
    respuesta = api_as(profesor).delete(detalle(entrega_corregida))

    assert respuesta.status_code == 403
    entrega_corregida.refresh_from_db()
    assert entrega_corregida.fecha_baja is None


@pytest.mark.django_db
def test_administrador_da_de_baja_logica_una_entrega_corregida(api_as, admin, entrega_corregida):
    respuesta = api_as(admin).delete(detalle(entrega_corregida))

    assert respuesta.status_code == 204
    entrega_corregida.refresh_from_db()
    assert entrega_corregida.fecha_baja is not None


@pytest.mark.django_db
def test_estudiante_no_puede_modificar_una_entrega_corregida(api_as, estudiante, entrega_corregida):
    respuesta = api_as(estudiante).patch(detalle(entrega_corregida), {'contenido_texto': 'Cambio tardío'}, format='json')

    assert respuesta.status_code == 400
    entrega_corregida.refresh_from_db()
    assert entrega_corregida.contenido_texto == 'Primera versión'


@pytest.mark.django_db
def test_estudiante_borra_su_entrega_sin_corregir(api_as, estudiante, entrega):
    respuesta = api_as(estudiante).delete(detalle(entrega))

    assert respuesta.status_code == 204
    entrega.refresh_from_db()
    assert entrega.fecha_baja is not None


@pytest.mark.django_db
def test_profesor_borra_una_entrega_sin_corregir_de_su_materia(api_as, profesor, entrega):
    respuesta = api_as(profesor).delete(detalle(entrega))

    assert respuesta.status_code == 204


@pytest.mark.django_db
@pytest.mark.parametrize('metodo', ['put', 'patch'])
@pytest.mark.parametrize('quien', ['profesor', 'admin'])
def test_profesor_y_administrador_no_pueden_editar_el_contenido_de_una_entrega(
    api_as, request, quien, metodo, entrega, actividad
):
    # Decisión D-1: el profesor solo califica y el administrador solo da de baja o restaura
    actor = request.getfixturevalue(quien)
    cuerpo = {'contenido_texto': 'Texto reescrito por otro'}
    if metodo == 'put':
        cuerpo['actividad'] = actividad.pk

    respuesta = getattr(api_as(actor), metodo)(detalle(entrega), cuerpo, format='json')

    assert respuesta.status_code == 403
    entrega.refresh_from_db()
    assert entrega.contenido_texto == 'Primera versión'


@pytest.mark.django_db
@pytest.mark.parametrize('metodo', ['put', 'patch'])
@pytest.mark.parametrize('quien', ['profesor', 'admin'])
def test_profesor_y_administrador_reciben_403_aunque_el_cuerpo_sea_invalido(api_as, request, quien, metodo, entrega):
    # La denegación va antes que la validación: no se filtra qué campos acepta la entrega
    actor = request.getfixturevalue(quien)

    respuesta = getattr(api_as(actor), metodo)(detalle(entrega), {'actividad': 'no-es-un-id', 'enlace': 'x'}, format='json')

    assert respuesta.status_code == 403
    entrega.refresh_from_db()
    assert entrega.contenido_texto == 'Primera versión'
