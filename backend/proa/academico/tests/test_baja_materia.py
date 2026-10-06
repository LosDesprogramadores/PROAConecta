"""Baja lógica de materias sin borrado en cascada (BE-08, TSK144)."""
import datetime

import pytest
from django.db.models import ProtectedError
from django.utils import timezone

from academico.models import Inscripcion, Materia
from academico.selectors import materias_con_acceso
from academico.tests.factories import InscripcionFactory, MateriaFactory
from aula_virtual.models import Actividad, Entrega, Material, Nota, Unidad
from usuario.tests.factories import PersonaFactory, UsuarioFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def materia_completa(profesor, estudiante):
    materia = MateriaFactory(profesor=profesor.persona, titulo='Álgebra')
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    unidad = Unidad.objects.create(materia=materia, titulo='Unidad 1')
    Material.objects.create(materia=materia, unidad=unidad, titulo='Apunte')
    actividad = Actividad.objects.create(materia=materia, unidad=unidad, titulo='TP 1')
    entrega = Entrega.objects.create(actividad=actividad, estudiante=estudiante.persona, contenido_texto='resuelto')
    Nota.objects.create(entrega=entrega, profesor=profesor.persona, calificacion=9)
    return materia


def _conteos():
    return {
        'unidades': Unidad.objects.count(),
        'materiales': Material.objects.count(),
        'actividades': Actividad.objects.count(),
        'entregas': Entrega.objects.count(),
        'notas': Nota.objects.count(),
        'inscripciones': Inscripcion.objects.count(),
    }


def _dar_de_baja(materia):
    materia.soft_delete()
    return materia


# --- el borrado ya no es en cascada ---

def test_eliminar_una_materia_la_da_de_baja_y_conserva_todo_su_contenido(api_as, admin, materia_completa):
    antes = _conteos()

    respuesta = api_as(admin).delete(f'/api/materias/{materia_completa.pk}/')

    assert respuesta.status_code == 204
    materia = Materia.todas.get(pk=materia_completa.pk)
    assert materia.fecha_baja is not None
    assert _conteos() == antes


@pytest.mark.parametrize('quien', ['profesor', 'estudiante'])
def test_solo_el_administrador_elimina_materias(quien, request, api_as, materia_completa):
    respuesta = api_as(request.getfixturevalue(quien)).delete(f'/api/materias/{materia_completa.pk}/')

    assert respuesta.status_code == 403
    assert Materia.todas.get(pk=materia_completa.pk).fecha_baja is None


def test_anonimo_no_elimina_materias(cliente_anonimo, materia_completa):
    assert cliente_anonimo.delete(f'/api/materias/{materia_completa.pk}/').status_code == 401


def test_borrar_de_verdad_una_materia_con_contenido_esta_protegido(materia_completa):
    with pytest.raises(ProtectedError):
        Materia.todas.get(pk=materia_completa.pk).delete()


def test_borrar_de_verdad_una_materia_solo_con_inscripciones_tambien_esta_protegido(estudiante):
    materia = MateriaFactory()
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)

    with pytest.raises(ProtectedError):
        materia.delete()


def test_el_mixin_vive_en_core_y_aula_virtual_lo_reexporta():
    from aula_virtual import models as modelos_aula
    from core import models as modelos_core

    assert modelos_aula.ContenidoSoftDelete is modelos_core.ContenidoSoftDelete
    assert issubclass(Materia, modelos_core.ContenidoSoftDelete)


def test_soft_delete_y_restore_del_modelo():
    materia = MateriaFactory()

    materia.soft_delete()
    assert Materia.todas.get(pk=materia.pk).fecha_baja is not None
    assert not Materia.objects.filter(pk=materia.pk).exists()

    materia.restore()
    assert Materia.objects.filter(pk=materia.pk).exists()


# --- las consultas excluyen las bajas ---

@pytest.mark.parametrize('quien', ['admin', 'profesor', 'estudiante'])
def test_el_listado_no_muestra_materias_dadas_de_baja(quien, request, api_as, materia_completa):
    visible = MateriaFactory(profesor=materia_completa.profesor)
    InscripcionFactory(materia=visible, estudiante=request.getfixturevalue('estudiante').persona)
    _dar_de_baja(materia_completa)

    ids = {m['id'] for m in api_as(request.getfixturevalue(quien)).get('/api/materias/').json()}

    assert materia_completa.pk not in ids
    assert visible.pk in ids


@pytest.mark.parametrize('quien', ['admin', 'profesor', 'estudiante'])
def test_el_detalle_de_una_materia_dada_de_baja_es_404(quien, request, api_as, materia_completa):
    _dar_de_baja(materia_completa)

    respuesta = api_as(request.getfixturevalue(quien)).get(f'/api/materias/{materia_completa.pk}/')

    assert respuesta.status_code == 404


def test_el_profesor_titular_no_accede_al_curso_de_una_materia_dada_de_baja(api_as, profesor, materia_completa):
    _dar_de_baja(materia_completa)
    cliente = api_as(profesor)

    assert cliente.get(f'/api/materias/{materia_completa.pk}/alumnos/').status_code == 404
    assert cliente.get(f'/api/materias/{materia_completa.pk}/rendimiento-curso/').status_code == 404


def test_el_estudiante_no_accede_a_su_rendimiento_en_una_materia_dada_de_baja(api_as, estudiante, materia_completa):
    _dar_de_baja(materia_completa)

    assert api_as(estudiante).get(f'/api/materias/{materia_completa.pk}/mi-rendimiento/').status_code == 404


def test_por_estudiante_no_lista_materias_dadas_de_baja(api_as, estudiante, materia_completa):
    _dar_de_baja(materia_completa)

    respuesta = api_as(estudiante).get(f'/api/materias/por-estudiante/{estudiante.persona.pk}/')

    assert respuesta.json() == []


def test_materias_con_acceso_excluye_las_dadas_de_baja(estudiante, materia_completa):
    _dar_de_baja(materia_completa)

    assert list(materias_con_acceso(estudiante.persona)) == []


@pytest.mark.parametrize('quien', ['profesor', 'estudiante'])
def test_el_contenido_de_una_materia_dada_de_baja_es_invisible(quien, request, api_as, materia_completa):
    _dar_de_baja(materia_completa)
    cliente = api_as(request.getfixturevalue(quien))

    for ruta in ('unidades', 'materiales', 'actividades', 'entregas'):
        respuesta = cliente.get(f'/api/{ruta}/')
        assert respuesta.status_code == 200
        assert respuesta.json() == [], ruta


def test_las_inscripciones_de_una_materia_dada_de_baja_no_se_listan(api_as, admin, estudiante, materia_completa):
    _dar_de_baja(materia_completa)

    assert api_as(estudiante).get('/api/inscripciones/').json() == []
    assert api_as(admin).get('/api/inscripciones/').json() == []


def test_no_se_puede_inscribir_en_una_materia_dada_de_baja(api_as, admin, rol_estudiante, materia_completa):
    otro = PersonaFactory(rol=rol_estudiante)
    _dar_de_baja(materia_completa)

    respuesta = api_as(admin).post(
        '/api/inscripciones/inscribir/', {'estudiante_id': otro.pk, 'materia_ids': [materia_completa.pk]}, format='json'
    )

    assert respuesta.status_code == 400
    assert 'materia_ids' in respuesta.json()


def test_no_se_pueden_crear_unidades_ni_actividades_en_una_materia_dada_de_baja(api_as, profesor, materia_completa):
    _dar_de_baja(materia_completa)
    cliente = api_as(profesor)

    unidad = cliente.post('/api/unidades/', {'materia': materia_completa.pk, 'titulo': 'Nueva'}, format='json')
    actividad = cliente.post(
        '/api/actividades/', {'materia': materia_completa.pk, 'titulo': 'Nueva', 'estado': 'BORRADOR'}, format='json'
    )

    assert unidad.status_code == 400
    assert actividad.status_code == 400


def test_el_estudiante_no_entrega_en_una_materia_dada_de_baja(api_as, estudiante, materia_completa):
    actividad = Actividad.objects.create(
        materia=materia_completa, titulo='Otra', fecha_limite=timezone.now() + datetime.timedelta(days=1)
    )
    _dar_de_baja(materia_completa)

    respuesta = api_as(estudiante).post(
        '/api/entregas/', {'actividad': actividad.pk, 'contenido_texto': 'x'}, format='json'
    )

    assert respuesta.status_code in (400, 403)
    assert not Entrega.objects.filter(actividad=actividad).exists()


def test_el_profesor_no_califica_en_una_materia_dada_de_baja(api_as, profesor, estudiante, materia_completa):
    actividad = materia_completa.actividades.get()
    _dar_de_baja(materia_completa)

    respuesta = api_as(profesor).post(
        f'/api/actividades/{actividad.pk}/calificar-estudiante/',
        {'estudiante_id': estudiante.persona.pk, 'calificacion': 7},
        format='json',
    )

    assert respuesta.status_code in (400, 404)
    assert Nota.objects.get().calificacion == 9


# --- papelera y restauración ---

def test_el_administrador_lista_la_papelera_de_materias(api_as, admin, materia_completa):
    otra = MateriaFactory()
    _dar_de_baja(materia_completa)

    respuesta = api_as(admin).get('/api/materias/?papelera=true')

    assert [m['id'] for m in respuesta.json()] == [materia_completa.pk]
    assert otra.pk not in [m['id'] for m in respuesta.json()]


@pytest.mark.parametrize('quien', ['profesor', 'estudiante'])
def test_la_papelera_de_materias_es_solo_del_administrador(quien, request, api_as, materia_completa):
    _dar_de_baja(materia_completa)

    respuesta = api_as(request.getfixturevalue(quien)).get('/api/materias/?papelera=true')

    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_restaurar_devuelve_la_materia_con_todo_su_contenido(api_as, admin, profesor, estudiante, materia_completa):
    antes = _conteos()
    _dar_de_baja(materia_completa)

    respuesta = api_as(admin).post(f'/api/materias/{materia_completa.pk}/restaurar/')

    assert respuesta.status_code == 200
    assert Materia.objects.filter(pk=materia_completa.pk).exists()
    assert _conteos() == antes
    assert api_as(profesor).get(f'/api/materias/{materia_completa.pk}/').status_code == 200
    assert len(api_as(estudiante).get('/api/materias/').json()) == 1


@pytest.mark.parametrize('quien', ['profesor', 'estudiante'])
def test_solo_el_administrador_restaura(quien, request, api_as, materia_completa):
    _dar_de_baja(materia_completa)

    respuesta = api_as(request.getfixturevalue(quien)).post(f'/api/materias/{materia_completa.pk}/restaurar/')

    assert respuesta.status_code == 403
    assert not Materia.objects.filter(pk=materia_completa.pk).exists()


def test_anonimo_no_restaura(cliente_anonimo, materia_completa):
    _dar_de_baja(materia_completa)

    assert cliente_anonimo.post(f'/api/materias/{materia_completa.pk}/restaurar/').status_code == 401


def test_restaurar_una_materia_activa_o_inexistente_es_404(api_as, admin, materia_completa):
    cliente = api_as(admin)

    assert cliente.post(f'/api/materias/{materia_completa.pk}/restaurar/').status_code == 404
    assert cliente.post('/api/materias/999999/restaurar/').status_code == 404


def test_se_puede_crear_otra_materia_con_los_mismos_datos_que_una_dada_de_baja(api_as, admin, materia_completa):
    _dar_de_baja(materia_completa)
    datos = {
        'titulo': materia_completa.titulo, 'curso': materia_completa.curso, 'anio': materia_completa.anio,
    }

    respuesta = api_as(admin).post('/api/materias/', datos, format='json')

    assert respuesta.status_code == 201


def test_no_se_puede_duplicar_una_materia_activa(api_as, admin, materia_completa):
    datos = {
        'titulo': materia_completa.titulo, 'curso': materia_completa.curso, 'anio': materia_completa.anio,
    }

    respuesta = api_as(admin).post('/api/materias/', datos, format='json')

    assert respuesta.status_code == 400


def test_restaurar_con_una_activa_igual_responde_400_y_no_restaura(api_as, admin, materia_completa):
    _dar_de_baja(materia_completa)
    MateriaFactory(titulo=materia_completa.titulo, curso=materia_completa.curso, anio=materia_completa.anio)

    respuesta = api_as(admin).post(f'/api/materias/{materia_completa.pk}/restaurar/')

    assert respuesta.status_code == 400
    assert 'detail' in respuesta.json()
    assert Materia.todas.get(pk=materia_completa.pk).fecha_baja is not None


def test_restaurar_no_deja_como_titular_a_un_profesor_dado_de_baja(api_as, admin, profesor, materia_completa):
    _dar_de_baja(materia_completa)
    profesor.persona.soft_delete()

    api_as(admin).post(f'/api/materias/{materia_completa.pk}/restaurar/')

    assert Materia.objects.get(pk=materia_completa.pk).profesor is None


def test_un_profesor_con_materias_solo_dadas_de_baja_puede_darse_de_baja(api_as, admin, profesor, materia_completa):
    Inscripcion.objects.all().update(estado=Inscripcion.EstadoInscripcion.BAJA)
    _dar_de_baja(materia_completa)

    respuesta = api_as(admin).delete(f'/api/personas/{profesor.persona.pk}/')

    assert respuesta.status_code == 200


def test_editar_una_materia_no_choca_consigo_misma(api_as, admin, materia_completa):
    respuesta = api_as(admin).patch(f'/api/materias/{materia_completa.pk}/', {'descripcion': 'nueva'}, format='json')

    assert respuesta.status_code == 200


def test_renombrar_una_materia_como_otra_activa_responde_400(api_as, admin, materia_completa):
    otra = MateriaFactory(titulo='Geometría', curso=materia_completa.curso, anio=materia_completa.anio)

    respuesta = api_as(admin).patch(f'/api/materias/{otra.pk}/', {'titulo': materia_completa.titulo}, format='json')

    assert respuesta.status_code == 400


@pytest.mark.parametrize('metodo', ['create', 'update'])
def test_una_carrera_contra_la_restriccion_responde_400_y_no_500(metodo, api_as, admin, materia_completa):
    from unittest import mock

    from django.db import IntegrityError
    from rest_framework import serializers as drf

    datos = {'titulo': 'Nueva', 'curso': '2do B', 'anio': 2026}
    with mock.patch.object(drf.ModelSerializer, metodo, side_effect=IntegrityError('unique')):
        if metodo == 'create':
            respuesta = api_as(admin).post('/api/materias/', datos, format='json')
        else:
            respuesta = api_as(admin).patch(f'/api/materias/{materia_completa.pk}/', {'titulo': 'Otra'}, format='json')

    assert respuesta.status_code == 400
    assert respuesta.json() == {'detail': 'Ya existe una materia con ese título, curso y año.'}
