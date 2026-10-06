"""Reglas de pares y repositorio de la mensajería (C3, TSK150)."""
from datetime import datetime, timedelta, timezone

import pytest
from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from mensajeria import repositorio, services
from notificacion import mongo
from usuario.tests.factories import UsuarioFactory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def coleccion_vacia():
    coleccion = mongo.obtener_coleccion(mongo.COLECCION_MENSAJE)
    coleccion.delete_many({})
    yield
    coleccion.delete_many({})


@pytest.fixture
def estudiante_ajeno(rol_estudiante):
    return UsuarioFactory(persona__rol=rol_estudiante)


@pytest.fixture
def profesor_ajeno(rol_profesor):
    return UsuarioFactory(persona__rol=rol_profesor)


def _enviar(remitente, destinatario, materia, cuerpo='Hola'):
    return services.enviar(remitente, materia.pk, destinatario.pk, 'Asunto', cuerpo)


# --- Pares permitidos ---

def test_profesor_titular_envia_a_inscripto_crea_mensaje_sin_leer(materia_con_inscripcion, profesor, estudiante):
    doc = _enviar(profesor, estudiante, materia_con_inscripcion)

    guardado = repositorio.obtener(doc['_id'])
    assert guardado['remitente_id'] == profesor.pk
    assert guardado['destinatario_id'] == estudiante.pk
    assert guardado['materia_id'] == materia_con_inscripcion.pk
    assert guardado['leido'] is False
    assert guardado['fecha_baja'] is None


def test_estudiante_inscripto_envia_a_su_profesor_titular(materia_con_inscripcion, profesor, estudiante):
    doc = _enviar(estudiante, profesor, materia_con_inscripcion)

    assert repositorio.obtener(doc['_id'])['destinatario_id'] == profesor.pk


@pytest.mark.parametrize('estado', ['CURSANDO', 'REGULAR', 'PROMOCIONADO', 'LIBRE'])
def test_estado_distinto_de_baja_puede_recibir_y_enviar(materia_con_inscripcion, profesor, estudiante, estado):
    Inscripcion.objects.filter(materia=materia_con_inscripcion).update(estado=estado)

    _enviar(profesor, estudiante, materia_con_inscripcion)
    _enviar(estudiante, profesor, materia_con_inscripcion)

    assert repositorio.contar_recibidos(estudiante.pk) == 1


# --- Pares rechazados ---

def test_estudiante_dado_de_baja_no_recibe_ni_envia(materia_con_inscripcion, profesor, estudiante):
    Inscripcion.objects.filter(materia=materia_con_inscripcion).update(estado='BAJA')

    with pytest.raises(PermissionDenied):
        _enviar(profesor, estudiante, materia_con_inscripcion)
    with pytest.raises(PermissionDenied):
        _enviar(estudiante, profesor, materia_con_inscripcion)
    assert repositorio.contar_recibidos(estudiante.pk) == 0


def test_estudiante_dado_de_baja_conserva_su_historial_pero_no_aparece_como_destinatario(
    materia_con_inscripcion, profesor, estudiante
):
    recibido, _ = repositorio.crear(_doc(remitente=profesor.pk, destinatario=estudiante.pk, materia_id=materia_con_inscripcion.pk))
    Inscripcion.objects.filter(materia=materia_con_inscripcion).update(estado='BAJA')

    assert repositorio.listar_recibidos(estudiante.pk, pagina=1, tamano=10)[1] == 1
    assert repositorio.marcar_leido(recibido, estudiante.pk) is True
    assert services.destinatarios(profesor, materia_con_inscripcion) == []
    with pytest.raises(PermissionDenied):
        services.destinatarios(estudiante, materia_con_inscripcion)


def test_estudiante_a_estudiante_se_rechaza(materia_con_inscripcion, estudiante, estudiante_ajeno):
    InscripcionFactory(materia=materia_con_inscripcion, estudiante=estudiante_ajeno.persona)

    with pytest.raises(PermissionDenied):
        _enviar(estudiante, estudiante_ajeno, materia_con_inscripcion)


def test_profesor_ajeno_no_puede_enviar_ni_recibir(materia_con_inscripcion, profesor_ajeno, estudiante):
    with pytest.raises(PermissionDenied):
        _enviar(profesor_ajeno, estudiante, materia_con_inscripcion)
    with pytest.raises(PermissionDenied):
        _enviar(estudiante, profesor_ajeno, materia_con_inscripcion)


def test_estudiante_no_inscripto_no_puede_enviar_ni_recibir(materia_con_inscripcion, profesor, estudiante_ajeno):
    with pytest.raises(PermissionDenied):
        _enviar(profesor, estudiante_ajeno, materia_con_inscripcion)
    with pytest.raises(PermissionDenied):
        _enviar(estudiante_ajeno, profesor, materia_con_inscripcion)


def test_administrador_no_puede_enviar_ni_recibir(materia_con_inscripcion, admin, profesor, estudiante):
    with pytest.raises(PermissionDenied):
        _enviar(admin, estudiante, materia_con_inscripcion)
    with pytest.raises(PermissionDenied):
        _enviar(profesor, admin, materia_con_inscripcion)


def test_profesor_a_si_mismo_se_rechaza(materia_con_inscripcion, profesor):
    with pytest.raises(PermissionDenied):
        _enviar(profesor, profesor, materia_con_inscripcion)


def test_materia_inexistente_o_dada_de_baja_responde_no_encontrada(materia_con_inscripcion, profesor, estudiante):
    with pytest.raises(Http404):
        services.enviar(profesor, 999999, estudiante.pk, 'A', 'B')

    materia_con_inscripcion.fecha_baja = datetime.now(timezone.utc).date()
    materia_con_inscripcion.save()
    with pytest.raises(Http404):
        _enviar(profesor, estudiante, materia_con_inscripcion)


def test_destinatario_inexistente_se_rechaza(materia_con_inscripcion, profesor):
    with pytest.raises(PermissionDenied):
        services.enviar(profesor, materia_con_inscripcion.pk, 999999, 'A', 'B')


# --- Destinatarios ---

def test_destinatarios_del_profesor_son_los_inscriptos_sin_baja(materia_con_inscripcion, profesor, estudiante, rol_estudiante):
    libre = UsuarioFactory(persona__rol=rol_estudiante)
    baja = UsuarioFactory(persona__rol=rol_estudiante)
    InscripcionFactory(materia=materia_con_inscripcion, estudiante=libre.persona, estado='LIBRE')
    InscripcionFactory(materia=materia_con_inscripcion, estudiante=baja.persona, estado='BAJA')

    ids = {d['id'] for d in services.destinatarios(profesor, materia_con_inscripcion)}

    assert ids == {estudiante.pk, libre.pk}


def test_destinatarios_del_estudiante_es_solo_el_titular(materia_con_inscripcion, profesor, estudiante):
    resultado = services.destinatarios(estudiante, materia_con_inscripcion)

    assert resultado == [{
        'id': profesor.pk,
        'nombre_completo': f'{profesor.persona.apellido}, {profesor.persona.nombre}',
        'rol': 'PROFESOR',
    }]


def test_destinatarios_rechaza_a_quien_no_pertenece_a_la_materia(materia_con_inscripcion, estudiante_ajeno, profesor_ajeno, admin):
    for usuario in (estudiante_ajeno, profesor_ajeno, admin):
        with pytest.raises(PermissionDenied):
            services.destinatarios(usuario, materia_con_inscripcion)


# --- Repositorio ---

def _doc(materia_id=1, remitente=10, destinatario=20, minutos=0, **extra):
    return {
        'materia_id': materia_id, 'remitente_id': remitente, 'destinatario_id': destinatario,
        'asunto': 'A', 'cuerpo': 'C', 'leido': False, 'fecha_baja': None,
        'fecha_creacion': datetime(2026, 10, 1, tzinfo=timezone.utc) + timedelta(minutes=minutos),
        **extra,
    }


def test_listar_recibidos_pagina_y_ordena_del_mas_nuevo_al_mas_viejo():
    for minuto in range(5):
        repositorio.crear(_doc(minutos=minuto, asunto=f'm{minuto}'))
    repositorio.crear(_doc(destinatario=99))

    docs, total = repositorio.listar_recibidos(20, pagina=1, tamano=2)
    siguiente, _ = repositorio.listar_recibidos(20, pagina=3, tamano=2)

    assert total == 5
    assert [d['asunto'] for d in docs] == ['m4', 'm3']
    assert [d['asunto'] for d in siguiente] == ['m0']


def test_listar_enviados_solo_devuelve_los_del_remitente():
    repositorio.crear(_doc(remitente=10))
    repositorio.crear(_doc(remitente=11))

    docs, total = repositorio.listar_enviados(10, pagina=1, tamano=10)

    assert total == 1 and docs[0]['remitente_id'] == 10


def test_listar_recibidos_filtra_por_materia_y_no_leidos():
    repositorio.crear(_doc(materia_id=1))
    repositorio.crear(_doc(materia_id=2, leido=True))
    repositorio.crear(_doc(materia_id=2))

    _, en_materia = repositorio.listar_recibidos(20, materia_id=2, pagina=1, tamano=10)
    _, sin_leer = repositorio.listar_recibidos(20, solo_no_leidos=True, pagina=1, tamano=10)

    assert en_materia == 2
    assert sin_leer == 2
    assert repositorio.contar_no_leidos(20) == 2


def test_marcar_leido_solo_aplica_al_destinatario_y_es_idempotente():
    id_, _ = repositorio.crear(_doc())

    assert repositorio.marcar_leido(id_, 99) is False
    assert repositorio.marcar_leido(id_, 20) is True
    assert repositorio.marcar_leido(id_, 20) is True
    assert repositorio.obtener(id_)['leido'] is True


def test_baja_logica_solo_del_remitente_y_oculta_el_mensaje():
    id_, _ = repositorio.crear(_doc())

    assert repositorio.dar_de_baja(id_, 99) is False
    assert repositorio.dar_de_baja(id_, 10) is True

    assert repositorio.contar_recibidos(20) == 0
    assert repositorio.listar_enviados(10, pagina=1, tamano=10)[1] == 0
    assert repositorio.marcar_leido(id_, 20) is False
    assert repositorio.obtener(id_)['fecha_baja'] is not None


def test_crear_indices_mongo_incluye_los_de_mensaje():
    from django.core.management import call_command

    call_command('crear_indices_mongo')

    claves = [i['key'] for i in mongo.obtener_coleccion(mongo.COLECCION_MENSAJE).index_information().values()]
    assert [('remitente_id', 1), ('fecha_creacion', -1)] in claves
    assert [('destinatario_id', 1), ('leido', 1), ('fecha_baja', 1)] in claves
    assert [('remitente_id', 1), ('fecha_baja', 1), ('fecha_creacion', -1)] in claves
    assert [('materia_id', 1), ('destinatario_id', 1), ('fecha_creacion', -1)] in claves
