"""Inscripción atómica de varios estudiantes en una materia (TSK189, decisión D2)."""
from unittest import mock

import pytest
from django.db.models import QuerySet

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from auditoria import bitacora
from notificacion import mongo
from usuario.tests.factories import PersonaFactory

URL = '/api/inscripciones/inscribir-estudiantes/'
ID_INEXISTENTE = 999999
Estado = Inscripcion.EstadoInscripcion

pytestmark = pytest.mark.django_db


@pytest.fixture
def materia():
    return MateriaFactory()


@pytest.fixture
def alumnos(rol_estudiante):
    return [PersonaFactory(rol=rol_estudiante) for _ in range(3)]


def cuerpo(materia, alumnos):
    return {'materia_id': materia.id, 'estudiante_ids': [a.id for a in alumnos]}


def inscribir(api_as, usuario, datos):
    return api_as(usuario).post(URL, datos, format='json')


def test_inscribe_a_todos_en_una_sola_operacion(api_as, admin, materia, alumnos):
    respuesta = inscribir(api_as, admin, cuerpo(materia, alumnos))

    assert respuesta.status_code == 201
    assert respuesta.data == {
        'mensaje': 'Se inscribió a 3 estudiantes en la materia.',
        'materia_id': materia.id,
        'cantidad': 3,
        'omitidos': [],
    }
    inscripciones = Inscripcion.objects.filter(materia=materia)
    assert inscripciones.count() == 3
    assert set(inscripciones.values_list('estado', flat=True)) == {Estado.CURSANDO}


def test_un_estudiante_ya_inscripto_se_omite_y_se_informa(api_as, admin, materia, alumnos):
    InscripcionFactory(materia=materia, estudiante=alumnos[0], estado=Estado.REGULAR)

    respuesta = inscribir(api_as, admin, cuerpo(materia, alumnos))

    assert respuesta.status_code == 201
    assert respuesta.data['cantidad'] == 2
    assert respuesta.data['omitidos'] == [alumnos[0].id]
    assert Inscripcion.objects.filter(materia=materia).count() == 3
    assert Inscripcion.objects.get(materia=materia, estudiante=alumnos[0]).estado == Estado.REGULAR


def test_un_estudiante_libre_sigue_en_la_materia_y_se_omite(api_as, admin, materia, alumnos):
    InscripcionFactory(materia=materia, estudiante=alumnos[0], estado=Estado.LIBRE)

    respuesta = inscribir(api_as, admin, cuerpo(materia, alumnos[:1]))

    assert respuesta.status_code == 201
    assert respuesta.data['cantidad'] == 0
    assert respuesta.data['omitidos'] == [alumnos[0].id]
    assert Inscripcion.objects.get(materia=materia, estudiante=alumnos[0]).estado == Estado.LIBRE


def test_una_inscripcion_en_baja_se_reactiva_sin_duplicar_la_fila(api_as, admin, materia, alumnos):
    baja = InscripcionFactory(materia=materia, estudiante=alumnos[0], estado=Estado.BAJA)

    respuesta = inscribir(api_as, admin, cuerpo(materia, alumnos))

    assert respuesta.status_code == 201
    assert respuesta.data['cantidad'] == 3
    assert respuesta.data['omitidos'] == []
    baja.refresh_from_db()
    assert baja.estado == Estado.CURSANDO
    assert Inscripcion.objects.filter(materia=materia, estudiante=alumnos[0]).count() == 1
    assert Inscripcion.objects.filter(materia=materia).count() == 3


@pytest.mark.parametrize('invalido', [
    {'estudiante_ids': []},
    {'estudiante_ids': 'no-es-lista'},
    {'estudiante_ids': None},
    {'estudiante_ids': ['x']},
    {'estudiante_ids': list(range(1, 202))},
])
def test_estudiante_ids_invalidos_devuelven_400_y_no_inscriben(api_as, admin, materia, alumnos, invalido):
    respuesta = inscribir(api_as, admin, {'materia_id': materia.id, **invalido})

    assert respuesta.status_code == 400
    assert 'estudiante_ids' in respuesta.data
    assert Inscripcion.objects.count() == 0


def test_un_id_inexistente_devuelve_400_y_no_inscribe_a_los_demas(api_as, admin, materia, alumnos):
    respuesta = inscribir(api_as, admin, {'materia_id': materia.id, 'estudiante_ids': [*(a.id for a in alumnos), ID_INEXISTENTE]})

    assert respuesta.status_code == 400
    assert str(ID_INEXISTENTE) in str(respuesta.data['estudiante_ids'])
    assert Inscripcion.objects.count() == 0


def test_doscientos_ids_es_el_maximo_aceptado(api_as, admin, materia, rol_estudiante):
    alumnos = PersonaFactory.create_batch(200, rol=rol_estudiante)

    respuesta = inscribir(api_as, admin, cuerpo(materia, alumnos))

    assert respuesta.status_code == 201
    assert respuesta.data['cantidad'] == 200


def test_ids_repetidos_devuelven_400(api_as, admin, materia, alumnos):
    respuesta = inscribir(api_as, admin, {'materia_id': materia.id, 'estudiante_ids': [alumnos[0].id, alumnos[0].id]})

    assert respuesta.status_code == 400
    assert 'estudiante_ids' in respuesta.data
    assert Inscripcion.objects.count() == 0


def test_una_persona_que_no_es_estudiante_devuelve_400(api_as, admin, materia, alumnos, profesor):
    respuesta = inscribir(api_as, admin, cuerpo(materia, [*alumnos, profesor.persona]))

    assert respuesta.status_code == 400
    assert 'estudiante_ids' in respuesta.data
    assert Inscripcion.objects.count() == 0


def test_un_estudiante_dado_de_baja_devuelve_400(api_as, admin, materia, alumnos):
    alumnos[0].soft_delete()

    respuesta = inscribir(api_as, admin, cuerpo(materia, alumnos))

    assert respuesta.status_code == 400
    assert 'estudiante_ids' in respuesta.data
    assert Inscripcion.objects.count() == 0


@pytest.mark.parametrize('materia_id', [ID_INEXISTENTE, 'abc', None])
def test_materia_inexistente_o_invalida_devuelve_400(api_as, admin, alumnos, materia_id):
    respuesta = inscribir(api_as, admin, {'materia_id': materia_id, 'estudiante_ids': [a.id for a in alumnos]})

    assert respuesta.status_code == 400
    assert 'materia_id' in respuesta.data
    assert Inscripcion.objects.count() == 0


def test_una_materia_dada_de_baja_devuelve_400(api_as, admin, materia, alumnos):
    materia.soft_delete()

    respuesta = inscribir(api_as, admin, cuerpo(materia, alumnos))

    assert respuesta.status_code == 400
    assert 'materia_id' in respuesta.data
    assert Inscripcion.objects.count() == 0


@pytest.mark.parametrize('quien', ['profesor', 'estudiante'])
def test_solo_el_administrador_inscribe(quien, request, api_as, materia, alumnos):
    respuesta = inscribir(api_as, request.getfixturevalue(quien), cuerpo(materia, alumnos))

    assert respuesta.status_code == 403
    assert Inscripcion.objects.count() == 0


def test_anonimo_recibe_401(cliente_anonimo, materia, alumnos):
    assert cliente_anonimo.post(URL, cuerpo(materia, alumnos), format='json').status_code == 401


def test_si_algo_falla_a_mitad_no_queda_ninguna_inscripcion(api_as, admin, materia, alumnos):
    InscripcionFactory(materia=materia, estudiante=alumnos[2], estado=Estado.BAJA)
    original = bitacora.registrar_evento
    llamadas = []

    def falla_en_el_segundo(*args, **kwargs):
        llamadas.append(args)
        if len(llamadas) == 2:
            raise RuntimeError('falla simulada')
        return original(*args, **kwargs)

    with mock.patch('academico.services.registrar_evento', side_effect=falla_en_el_segundo):
        cliente = api_as(admin)
        cliente.raise_request_exception = False
        respuesta = cliente.post(URL, cuerpo(materia, alumnos), format='json')

    assert respuesta.status_code == 500
    assert Inscripcion.objects.filter(materia=materia).count() == 1
    assert Inscripcion.objects.get(materia=materia).estado == Estado.BAJA


def test_registra_un_evento_por_inscripcion_creada_o_reactivada(api_as, admin, materia, alumnos, django_capture_on_commit_callbacks):
    coleccion = mongo.obtener_coleccion(mongo.COLECCION_BITACORA)
    coleccion.delete_many({})
    InscripcionFactory(materia=materia, estudiante=alumnos[0], estado=Estado.BAJA)
    InscripcionFactory(materia=materia, estudiante=alumnos[1], estado=Estado.CURSANDO)

    with django_capture_on_commit_callbacks(execute=True):
        inscribir(api_as, admin, cuerpo(materia, alumnos))

    eventos = list(coleccion.find({'tipo': 'INSCRIPCION_CREADA'}))
    coleccion.delete_many({})
    assert len(eventos) == 2
    assert {e['materia_id'] for e in eventos} == {materia.id}
    reactivado = next(e for e in eventos if e['datos']['despues']['estudiante_id'] == alumnos[0].id)
    assert reactivado['datos']['antes'] == {'estado': 'BAJA'}
    assert reactivado['datos']['despues']['estado'] == Estado.CURSANDO


@pytest.mark.parametrize('cantidad', [1, 20])
def test_las_consultas_no_dependen_de_la_cantidad_de_estudiantes(
    api_as, admin, materia, rol_estudiante, django_assert_max_num_queries, cantidad
):
    alumnos = PersonaFactory.create_batch(cantidad, rol=rol_estudiante)
    for alumno in alumnos[::2]:
        InscripcionFactory(materia=materia, estudiante=alumno, estado=Estado.BAJA)
    cliente = api_as(admin)

    with django_assert_max_num_queries(10):
        respuesta = cliente.post(URL, cuerpo(materia, alumnos), format='json')

    assert respuesta.status_code == 201


def _conflicto_tras_la_primera_lectura(estudiante, materia, estado):
    """Simula otro lote que inscribe el par (y confirma) justo después de la lectura con bloqueo."""
    real = QuerySet._fetch_all
    lecturas = []

    def con_carrera(self):
        ya_cargado = self._result_cache is not None
        real(self)
        if not ya_cargado and self.model is Inscripcion and self.query.select_for_update:
            lecturas.append(self)
            if len(lecturas) == 1:
                Inscripcion.objects.create(materia=materia, estudiante=estudiante, estado=estado)

    return mock.patch.object(QuerySet, '_fetch_all', autospec=True, side_effect=con_carrera)


def test_un_lote_concurrente_sobre_el_mismo_par_no_rompe_y_omite_el_conflicto(
    api_as, admin, materia, alumnos, django_capture_on_commit_callbacks
):
    coleccion = mongo.obtener_coleccion(mongo.COLECCION_BITACORA)
    coleccion.delete_many({})

    with _conflicto_tras_la_primera_lectura(alumnos[0], materia, Estado.CURSANDO):
        with django_capture_on_commit_callbacks(execute=True):
            respuesta = inscribir(api_as, admin, cuerpo(materia, alumnos))

    eventos = list(coleccion.find({'tipo': 'INSCRIPCION_CREADA'}))
    coleccion.delete_many({})
    assert respuesta.status_code == 201
    assert respuesta.data['cantidad'] == 2
    assert respuesta.data['omitidos'] == [alumnos[0].id]
    assert Inscripcion.objects.filter(materia=materia).count() == 3
    assert sorted(e['datos']['despues']['estudiante_id'] for e in eventos) == sorted(a.id for a in alumnos[1:])


def test_un_conflicto_concurrente_que_quedo_en_baja_se_reactiva_sin_duplicar(
    api_as, admin, materia, alumnos, django_capture_on_commit_callbacks
):
    coleccion = mongo.obtener_coleccion(mongo.COLECCION_BITACORA)
    coleccion.delete_many({})

    with _conflicto_tras_la_primera_lectura(alumnos[0], materia, Estado.BAJA):
        with django_capture_on_commit_callbacks(execute=True):
            respuesta = inscribir(api_as, admin, cuerpo(materia, alumnos))

    eventos = list(coleccion.find({'tipo': 'INSCRIPCION_CREADA'}))
    coleccion.delete_many({})
    assert respuesta.status_code == 201
    assert respuesta.data['cantidad'] == 3
    assert respuesta.data['omitidos'] == []
    assert Inscripcion.objects.filter(materia=materia).count() == 3
    assert Inscripcion.objects.get(materia=materia, estudiante=alumnos[0]).estado == Estado.CURSANDO
    assert len(eventos) == 3
    assert len({e['entidad_id'] for e in eventos}) == 3
