"""Enganches de la bitácora en inscripciones, personas, materias, notas y mensajes (C15, #219).

Un evento por acción confirmada; ninguno si la transacción se revierte; solo ids (sin DNI, correo ni cuerpo).
"""
from decimal import Decimal
from unittest import mock

import pytest
from django.db import transaction

from academico.models import Inscripcion, Materia
from academico.tests.factories import InscripcionFactory, MateriaFactory
from auditoria import bitacora
from aula_virtual.models import Actividad, Nota
from aula_virtual.services import calificar_o_rectificar_estudiante
from mensajeria import services as mensajes
from notificacion import mongo
from usuario.models import Persona
from usuario.tests.factories import UsuarioFactory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def colecciones_vacias():
    nombres = (mongo.COLECCION_BITACORA, mongo.COLECCION_MENSAJE)
    for nombre in nombres:
        mongo.obtener_coleccion(nombre).delete_many({})
    yield
    for nombre in nombres:
        mongo.obtener_coleccion(nombre).delete_many({})


@pytest.fixture
def confirmar(django_capture_on_commit_callbacks):
    # Ejecuta los on_commit pendientes, como pasaría al confirmarse la transacción real
    return lambda: django_capture_on_commit_callbacks(execute=True)


def eventos(tipo=None):
    filtro = {'tipo': tipo} if tipo else {}
    return list(mongo.obtener_coleccion(mongo.COLECCION_BITACORA).find(filtro))


def unico(tipo):
    encontrados = eventos(tipo)
    assert len(encontrados) == 1, encontrados
    return encontrados[0]


@pytest.fixture
def materia(profesor):
    return MateriaFactory(profesor=profesor.persona)


# --- Inscripciones ---

def test_inscribir_registra_un_evento_por_materia(api_as, admin, estudiante, confirmar):
    m1, m2 = MateriaFactory(), MateriaFactory(curso='2do B')
    with confirmar():
        r = api_as(admin).post('/api/inscripciones/inscribir/', {
            'estudiante_id': estudiante.persona.id, 'materia_ids': [m1.id, m2.id]}, format='json')
    assert r.status_code == 201

    registrados = eventos('INSCRIPCION_CREADA')
    assert len(registrados) == 2
    assert {e['materia_id'] for e in registrados} == {m1.id, m2.id}
    primero = registrados[0]
    assert primero['actor_id'] == admin.pk and primero['entidad'] == 'inscripcion'
    assert primero['datos']['despues'] == {'estado': 'CURSANDO', 'estudiante_id': estudiante.persona.id}
    assert primero['entidad_id'] == Inscripcion.objects.get(materia_id=primero['materia_id']).pk


def test_reinscribir_una_baja_registra_el_estado_anterior(api_as, admin, estudiante, materia, confirmar):
    InscripcionFactory(materia=materia, estudiante=estudiante.persona, estado='BAJA')
    with confirmar():
        api_as(admin).post('/api/inscripciones/inscribir/', {
            'estudiante_id': estudiante.persona.id, 'materia_ids': [materia.id]}, format='json')

    assert unico('INSCRIPCION_CREADA')['datos']['antes'] == {'estado': 'BAJA'}


def test_inscribir_a_quien_ya_cursa_no_registra_nada(api_as, admin, estudiante, materia, confirmar):
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    with confirmar():
        api_as(admin).post('/api/inscripciones/inscribir/', {
            'estudiante_id': estudiante.persona.id, 'materia_ids': [materia.id]}, format='json')

    assert eventos() == []


def test_inscribir_con_rollback_no_deja_eventos(api_as, admin, estudiante, confirmar):
    m1, m2 = MateriaFactory(), MateriaFactory(curso='2do B')
    original = bitacora.registrar_evento
    llamadas = []

    def falla_en_la_segunda(*args, **kwargs):
        llamadas.append(1)
        if len(llamadas) == 2:
            raise RuntimeError('falla a mitad del lote')
        return original(*args, **kwargs)

    with confirmar():
        with mock.patch('academico.services.registrar_evento', side_effect=falla_en_la_segunda):
            cliente = api_as(admin)
            cliente.raise_request_exception = False
            r = cliente.post('/api/inscripciones/inscribir/', {
                'estudiante_id': estudiante.persona.id, 'materia_ids': [m1.id, m2.id]}, format='json')

    assert r.status_code == 500
    assert not Inscripcion.objects.filter(estudiante=estudiante.persona).exists()
    assert eventos() == []


def test_desinscribir_registra_la_baja(api_as, admin, estudiante, materia, confirmar):
    inscripcion = InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    with confirmar():
        r = api_as(admin).post('/api/inscripciones/desinscribir/', {
            'estudiante_id': estudiante.persona.id, 'materia_id': materia.id}, format='json')
    assert r.status_code == 200

    evento = unico('INSCRIPCION_BAJA')
    assert evento['entidad_id'] == inscripcion.pk and evento['materia_id'] == materia.id
    assert evento['datos'] == {
        'antes': {'estado': 'CURSANDO', 'estudiante_id': estudiante.persona.id},
        'despues': {'estado': 'BAJA', 'estudiante_id': estudiante.persona.id},
    }


def test_desinscribir_rechazado_por_tener_notas_no_registra_nada(api_as, admin, estudiante, materia, confirmar):
    from academico.tests.factories import cargar_nota, crear_actividad

    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    cargar_nota(crear_actividad(materia, 'TP'), estudiante.persona, 8)
    eventos_previos = len(eventos())
    with confirmar():
        r = api_as(admin).post('/api/inscripciones/desinscribir/', {
            'estudiante_id': estudiante.persona.id, 'materia_id': materia.id}, format='json')

    assert r.status_code == 400
    assert len(eventos()) == eventos_previos == 0


# --- Profesores y materias ---

def test_asignar_profesor_registra_un_evento_por_materia_con_el_titular_anterior(api_as, admin, profesor, confirmar):
    anterior = UsuarioFactory(persona__rol=profesor.persona.rol)
    m1, m2 = MateriaFactory(profesor=anterior.persona), MateriaFactory(curso='2do B')
    with confirmar():
        r = api_as(admin).post('/api/materias/asignar-profesor/', {
            'profesor_id': profesor.persona.id, 'materia_ids': [m1.id, m2.id]}, format='json')
    assert r.status_code == 200

    por_materia = {e['materia_id']: e for e in eventos('PROFESOR_ASIGNADO')}
    assert set(por_materia) == {m1.id, m2.id}
    assert por_materia[m1.id]['datos'] == {
        'antes': {'profesor_id': anterior.persona.id}, 'despues': {'profesor_id': profesor.persona.id}}
    assert por_materia[m2.id]['datos']['antes'] == {'profesor_id': None}
    assert por_materia[m1.id]['entidad'] == 'materia' and por_materia[m1.id]['entidad_id'] == m1.id


def test_desasignar_profesor_registra_el_desvinculo(api_as, admin, profesor, materia, confirmar):
    with confirmar():
        r = api_as(admin).patch(f'/api/materias/{materia.id}/desasignar-profesor/')
    assert r.status_code == 200

    assert unico('PROFESOR_DESVINCULADO')['datos'] == {
        'antes': {'profesor_id': profesor.persona.id}, 'despues': {'profesor_id': None}}


def test_desasignar_una_materia_sin_profesor_no_registra_nada(api_as, admin, confirmar):
    materia = MateriaFactory()
    with confirmar():
        api_as(admin).patch(f'/api/materias/{materia.id}/desasignar-profesor/')
    assert eventos() == []


def test_baja_y_restauracion_de_materia(api_as, admin, materia, confirmar):
    with confirmar():
        assert api_as(admin).delete(f'/api/materias/{materia.id}/').status_code == 204
    baja = unico('MATERIA_BAJA')
    assert baja['entidad'] == 'materia' and baja['entidad_id'] == materia.id and baja['materia_id'] == materia.id

    with confirmar():
        assert api_as(admin).post(f'/api/materias/{materia.id}/restaurar/').status_code == 200
    assert unico('MATERIA_RESTAURADA')['entidad_id'] == materia.id


def test_restaurar_con_conflicto_de_unicidad_no_registra_la_restauracion(api_as, admin, materia, confirmar):
    materia.soft_delete()
    MateriaFactory(titulo=materia.titulo, curso=materia.curso, anio=materia.anio)
    with confirmar():
        r = api_as(admin).post(f'/api/materias/{materia.id}/restaurar/')

    assert r.status_code == 400
    assert eventos('MATERIA_RESTAURADA') == []
    assert Materia.todas.get(pk=materia.pk).fecha_baja is not None


# --- Personas ---

def test_baja_y_restauracion_de_persona_registran_el_estado_de_la_cuenta(api_as, admin, rol_estudiante, confirmar):
    otro = UsuarioFactory(persona__rol=rol_estudiante)
    persona = otro.persona
    with confirmar():
        assert api_as(admin).delete(f'/api/personas/{persona.id}/').status_code == 200

    baja = unico('PERSONA_BAJA')
    assert baja['entidad'] == 'persona' and baja['entidad_id'] == persona.id
    assert baja['datos'] == {'antes': {'activo': True}, 'despues': {'activo': False}}

    with confirmar():
        assert api_as(admin).post(f'/api/personas/{persona.id}/restaurar/').status_code == 200
    assert unico('PERSONA_RESTAURADA')['datos'] == {'antes': {'activo': False}, 'despues': {'activo': True}}


def test_baja_rechazada_no_registra_nada(api_as, admin, confirmar):
    with confirmar():
        r = api_as(admin).delete(f'/api/personas/{admin.persona.id}/')  # su propia cuenta
    assert r.status_code == 400
    assert eventos() == []


def test_cambio_de_rol_registra_rol_anterior_y_nuevo(api_as, admin, rol_estudiante, rol_profesor, confirmar):
    persona = UsuarioFactory(persona__rol=rol_estudiante).persona
    with confirmar():
        r = api_as(admin).patch(f'/api/personas/{persona.id}/', {'rol': rol_profesor.id}, format='json')
    assert r.status_code == 200

    evento = unico('ROL_CAMBIADO')
    assert evento['entidad_id'] == persona.id
    assert evento['datos'] == {'antes': {'rol_id': rol_estudiante.id}, 'despues': {'rol_id': rol_profesor.id}}


def test_editar_otros_campos_no_registra_cambio_de_rol(api_as, admin, rol_estudiante, confirmar):
    persona = UsuarioFactory(persona__rol=rol_estudiante).persona
    with confirmar():
        r = api_as(admin).patch(f'/api/personas/{persona.id}/', {'nombre': 'Nuevo'}, format='json')
    assert r.status_code == 200
    assert eventos() == []


def test_los_eventos_de_personas_no_llevan_pii(api_as, admin, rol_estudiante, rol_profesor, confirmar):
    persona = UsuarioFactory(persona__rol=rol_estudiante).persona
    with confirmar():
        api_as(admin).patch(f'/api/personas/{persona.id}/', {'rol': rol_profesor.id}, format='json')
        api_as(admin).delete(f'/api/personas/{persona.id}/')
    texto = str(eventos())
    for dato in (persona.dni, persona.email, persona.apellido, persona.nombre):
        assert dato not in texto


# --- Notas ---

@pytest.fixture
def actividad(materia):
    return Actividad.objects.create(materia=materia, titulo='TP', estado=Actividad.EstadoActividad.PUBLICADA)


def test_primera_calificacion_registra_nota_creada(profesor, estudiante, materia, actividad, confirmar):
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    with confirmar():
        nota = calificar_o_rectificar_estudiante(profesor, actividad.id, estudiante.persona.id, '6', 'Bien')

    evento = unico('NOTA_CREADA')
    assert evento['entidad'] == 'nota' and evento['entidad_id'] == nota.pk and evento['materia_id'] == materia.id
    assert evento['actor_id'] == profesor.pk
    assert evento['datos'] == {'despues': {'calificacion': '6.00'}}
    assert 'Bien' not in str(evento)  # la devolución escrita no se guarda


def test_rectificar_registra_antes_y_despues(profesor, estudiante, materia, actividad, confirmar):
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    calificar_o_rectificar_estudiante(profesor, actividad.id, estudiante.persona.id, '6')
    with confirmar():
        calificar_o_rectificar_estudiante(profesor, actividad.id, estudiante.persona.id, '7.5')

    assert unico('NOTA_MODIFICADA')['datos'] == {
        'antes': {'calificacion': '6.00'}, 'despues': {'calificacion': '7.50'}}
    assert Nota.objects.get().calificacion == Decimal('7.50')


def test_calificacion_invalida_no_registra_nada(profesor, estudiante, materia, actividad, confirmar):
    from rest_framework.exceptions import ValidationError

    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    with confirmar():
        with pytest.raises(ValidationError):
            calificar_o_rectificar_estudiante(profesor, actividad.id, estudiante.persona.id, '11')
    assert eventos() == []


def test_calificar_con_rollback_no_deja_evento(profesor, estudiante, materia, actividad, confirmar):
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    with confirmar():
        with pytest.raises(RuntimeError):
            with transaction.atomic():
                calificar_o_rectificar_estudiante(profesor, actividad.id, estudiante.persona.id, '6')
                raise RuntimeError('rollback')
    assert eventos() == []
    assert not Nota.objects.exists()


# --- Mensajes ---

def test_enviar_mensaje_registra_el_evento_sin_cuerpo_ni_asunto(profesor, estudiante, materia, confirmar):
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)
    with confirmar():
        documento = mensajes.enviar(profesor, materia.pk, estudiante.pk, 'Asunto reservado', 'Cuerpo reservado')

    evento = unico('MENSAJE_ENVIADO')
    assert evento['actor_id'] == profesor.pk and evento['entidad'] == 'mensaje' and evento['materia_id'] == materia.pk
    assert evento['datos'] == {'despues': {'mensaje_id': str(documento['_id']), 'destinatario_id': estudiante.pk}}
    assert 'reservado' not in str(evento)


def test_mensaje_rechazado_no_registra_nada(profesor, materia, rol_estudiante, confirmar):
    from rest_framework.exceptions import PermissionDenied

    ajeno = UsuarioFactory(persona__rol=rol_estudiante)
    with confirmar():
        with pytest.raises(PermissionDenied):
            mensajes.enviar(profesor, materia.pk, ajeno.pk, 'Hola', 'Hola')
    assert eventos() == []


def test_si_mongo_falla_la_operacion_principal_sigue(api_as, admin, estudiante, materia, confirmar):
    from pymongo.errors import PyMongoError

    with confirmar():
        with mock.patch('auditoria.bitacora.obtener_coleccion', side_effect=PyMongoError('caído')):
            r = api_as(admin).post('/api/inscripciones/inscribir/', {
                'estudiante_id': estudiante.persona.id, 'materia_ids': [materia.id]}, format='json')

    assert r.status_code == 201
    assert Inscripcion.objects.filter(materia=materia, estudiante=estudiante.persona).exists()
