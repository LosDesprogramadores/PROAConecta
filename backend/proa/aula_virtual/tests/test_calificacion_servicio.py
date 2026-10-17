"""Calificación atómica y auditada: los dos endpoints usan el mismo servicio (TSK177, #306)."""
from unittest import mock

import pytest

from academico.tests.factories import InscripcionFactory, MateriaFactory
from aula_virtual.models import Actividad, Entrega, Nota
from notificacion import mongo

pytestmark = pytest.mark.django_db


@pytest.fixture
def confirmar(django_capture_on_commit_callbacks):
    return lambda: django_capture_on_commit_callbacks(execute=True)


@pytest.fixture
def materia(profesor):
    return MateriaFactory(profesor=profesor.persona)


@pytest.fixture
def actividad(materia):
    return Actividad.objects.create(materia=materia, titulo='TP', estado=Actividad.EstadoActividad.PUBLICADA)


@pytest.fixture
def entrega(actividad, estudiante, materia):
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    return Entrega.objects.create(actividad=actividad, estudiante=estudiante.persona)


def eventos(tipo=None):
    filtro = {'tipo': tipo} if tipo else {}
    return list(mongo.obtener_coleccion(mongo.COLECCION_BITACORA).find(filtro))


def test_calificar_entrega_registra_nota_creada_y_luego_modificada(api_as, profesor, entrega, confirmar):
    with confirmar():
        r = api_as(profesor).post(f'/api/entregas/{entrega.id}/calificar/', {'calificacion': '6', 'descripcion': 'Bien'}, format='json')
    assert r.status_code == 200
    (evento,) = eventos('NOTA_CREADA')
    assert evento['entidad'] == 'nota' and evento['actor_id'] == profesor.pk
    assert evento['materia_id'] == entrega.actividad.materia_id
    assert evento['datos'] == {'despues': {'calificacion': '6.00'}}

    with confirmar():
        r = api_as(profesor).patch(f'/api/entregas/{entrega.id}/calificar/', {'calificacion': '8'}, format='json')
    assert r.status_code == 200
    (evento,) = eventos('NOTA_MODIFICADA')
    assert evento['datos'] == {'antes': {'calificacion': '6.00'}, 'despues': {'calificacion': '8.00'}}
    entrega.refresh_from_db()
    assert entrega.estado == Entrega.EstadoEntrega.CORREGIDO


def test_calificar_estudiante_registra_nota_creada(api_as, profesor, actividad, estudiante, materia, confirmar):
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    with confirmar():
        r = api_as(profesor).post(
            f'/api/actividades/{actividad.id}/calificar-estudiante/',
            {'estudiante_id': estudiante.persona.id, 'calificacion': '7'}, format='json')
    assert r.status_code == 200
    (evento,) = eventos('NOTA_CREADA')
    assert evento['datos'] == {'despues': {'calificacion': '7.00'}}


def test_calificar_entrega_fuera_de_rango_no_cambia_nada(api_as, profesor, entrega, confirmar):
    with confirmar():
        r = api_as(profesor).post(f'/api/entregas/{entrega.id}/calificar/', {'calificacion': '11'}, format='json')
    assert r.status_code == 400
    assert not Nota.objects.exists()
    assert eventos() == []


def test_error_tras_crear_la_entrega_administrativa_revierte_todo(api_as, profesor, actividad, estudiante, materia, confirmar):
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    with mock.patch.object(Nota.objects, 'update_or_create', side_effect=RuntimeError('falla')):
        with confirmar():
            r = api_as(profesor).post(
                f'/api/actividades/{actividad.id}/calificar-estudiante/',
                {'estudiante_id': estudiante.persona.id, 'calificacion': '7'}, format='json')
    assert r.status_code == 500
    assert not Entrega.objects.exists()
    assert not Nota.objects.exists()
    assert eventos() == []


def test_error_al_calificar_entrega_no_deja_nota_ni_evento(api_as, profesor, entrega, confirmar):
    with mock.patch.object(Entrega, 'save', side_effect=RuntimeError('falla')):
        with confirmar():
            r = api_as(profesor).post(f'/api/entregas/{entrega.id}/calificar/', {'calificacion': '5'}, format='json')
    assert r.status_code == 500
    assert not Nota.objects.exists()
    assert eventos() == []


def test_calificar_entrega_responde_con_la_forma_de_nota_serializer(api_as, profesor, entrega):
    r = api_as(profesor).post(f'/api/entregas/{entrega.id}/calificar/', {'calificacion': '7.5', 'descripcion': ' Muy bien '}, format='json')
    assert r.status_code == 200
    nota = Nota.objects.get(entrega=entrega)
    assert set(r.json()) == {'id', 'calificacion', 'descripcion', 'profesor_nombre', 'fecha_publicacion'}
    assert r.json()['id'] == nota.pk
    assert r.json()['calificacion'] == '7.50'
    assert r.json()['descripcion'] == 'Muy bien'
    assert r.json()['profesor_nombre'] == f'{profesor.persona.nombre} {profesor.persona.apellido}'.strip()


@pytest.mark.parametrize('valor', ['abc', '', None])
def test_calificar_entrega_con_valor_no_numerico_responde_400(api_as, profesor, entrega, valor):
    r = api_as(profesor).post(f'/api/entregas/{entrega.id}/calificar/', {'calificacion': valor}, format='json')
    assert r.status_code == 400
    assert 'calificacion' in r.json()
    assert not Nota.objects.exists()


def test_administrador_puede_calificar_una_entrega(api_as, admin, entrega, confirmar):
    with confirmar():
        r = api_as(admin).post(f'/api/entregas/{entrega.id}/calificar/', {'calificacion': '9'}, format='json')
    assert r.status_code == 200
    (evento,) = eventos('NOTA_CREADA')
    assert evento['actor_id'] == admin.pk


def test_estudiante_no_puede_calificar_su_entrega(api_as, estudiante, entrega):
    r = api_as(estudiante).post(f'/api/entregas/{entrega.id}/calificar/', {'calificacion': '9'}, format='json')
    assert r.status_code == 403
    assert not Nota.objects.exists()


def test_calificar_dos_veces_deja_una_nota_y_un_evento_de_cada_tipo(api_as, profesor, entrega, confirmar):
    with confirmar():
        api_as(profesor).post(f'/api/entregas/{entrega.id}/calificar/', {'calificacion': '5'}, format='json')
    with confirmar():
        api_as(profesor).post(f'/api/entregas/{entrega.id}/calificar/', {'calificacion': '9'}, format='json')
    assert Nota.objects.filter(entrega=entrega).count() == 1
    assert len(eventos('NOTA_CREADA')) == 1
    assert len(eventos('NOTA_MODIFICADA')) == 1
    assert len(eventos()) == 2
