from datetime import date, datetime

import pytest
from bson.objectid import ObjectId

from notificacion import mongo

URL = '/api/notificaciones/'
HOY = date(2026, 10, 10)


@pytest.fixture(autouse=True)
def hoy_fijo(monkeypatch):
    monkeypatch.setattr('notificacion.services.hoy', lambda: HOY)


@pytest.fixture
def publicados(monkeypatch):
    registro = []
    monkeypatch.setattr('notificacion.services.publicar', lambda grupo, tipo, datos: registro.append((grupo, tipo, datos)))
    return registro


def _coleccion():
    return mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION)


def _aviso(titulo, desde=None, hasta=None, **campos):
    doc = {'titulo': titulo, 'mensaje': 'm', 'alcance': 'AMBOS', 'materia_id': None,
           'fecha_creacion': datetime(2026, 1, 1), 'leida_por': [], 'fecha_desde': desde, 'fecha_hasta': hasta}
    doc.update(campos)
    return str(_coleccion().insert_one(doc).inserted_id)


def _titulos(respuesta):
    return {n['titulo'] for n in respuesta.json()}


@pytest.fixture
def avisos_por_fecha():
    _aviso('sin-fechas')
    _aviso('desde-vacio', desde='', hasta='')
    _aviso('desde-pasado', desde='2026-10-01')
    _aviso('desde-hoy', desde='2026-10-10')
    _aviso('desde-hoy-con-hora', desde='2026-10-10T18:30')
    _aviso('desde-manana', desde='2026-10-11')
    _aviso('hasta-hoy', desde='2026-10-01', hasta='2026-10-10')
    _aviso('hasta-hoy-con-hora', desde='2026-10-01', hasta='2026-10-10T00:00')
    _aviso('hasta-ayer', desde='2026-10-01', hasta='2026-10-09')
    _aviso('hasta-futuro', desde='2026-10-01', hasta='2026-12-31')


VISIBLES = {'sin-fechas', 'desde-vacio', 'desde-pasado', 'desde-hoy', 'desde-hoy-con-hora', 'hasta-hoy',
            'hasta-hoy-con-hora', 'hasta-futuro'}


@pytest.mark.parametrize('rol', ['profesor', 'estudiante'])
def test_destinatarios_solo_ven_avisos_vigentes(api_as, profesor, estudiante, rol, avisos_por_fecha):
    usuario = profesor if rol == 'profesor' else estudiante
    assert _titulos(api_as(usuario).get(URL)) == VISIBLES


def test_ultimo_dia_es_inclusivo_y_el_siguiente_no(api_as, estudiante, monkeypatch):
    _aviso('termina-hoy', desde='2026-10-01', hasta='2026-10-10')
    assert 'termina-hoy' in _titulos(api_as(estudiante).get(URL))
    monkeypatch.setattr('notificacion.services.hoy', lambda: date(2026, 10, 11))
    assert 'termina-hoy' not in _titulos(api_as(estudiante).get(URL))


def test_aviso_programado_aparece_el_dia_de_su_fecha(api_as, estudiante, monkeypatch):
    _aviso('futuro', desde='2026-10-11')
    assert 'futuro' not in _titulos(api_as(estudiante).get(URL))
    monkeypatch.setattr('notificacion.services.hoy', lambda: date(2026, 10, 11))
    assert 'futuro' in _titulos(api_as(estudiante).get(URL))


def test_programada_no_cuenta_como_no_leida(api_as, estudiante, avisos_por_fecha):
    cuerpo = api_as(estudiante).get(URL, {'page': 1}).json()
    assert cuerpo['count'] == len(VISIBLES)
    assert cuerpo['no_leidas'] == len(VISIBLES)


def test_programada_dirigida_a_un_usuario_tampoco_se_ve(api_as, estudiante):
    _aviso('para-mi-futuro', desde='2026-10-11', usuario_destino_id=estudiante.pk)
    assert _titulos(api_as(estudiante).get(URL)) == set()


def test_no_se_puede_leer_una_programada(api_as, estudiante):
    id_ = _aviso('futuro', desde='2026-10-11')
    assert api_as(estudiante).post(f'{URL}{id_}/leer/').status_code == 404


def test_administrador_ve_todo_con_estado_de_vigencia(api_as, admin, avisos_por_fecha):
    por_titulo = {n['titulo']: n['estado_vigencia'] for n in api_as(admin).get(URL).json()}
    assert len(por_titulo) == 10
    assert por_titulo['desde-manana'] == 'PROGRAMADA'
    assert por_titulo['hasta-ayer'] == 'VENCIDA'
    assert por_titulo['hasta-hoy'] == 'VIGENTE'
    assert por_titulo['sin-fechas'] == 'VIGENTE'
    assert por_titulo['desde-hoy-con-hora'] == 'VIGENTE'


def test_estado_de_vigencia_llega_tambien_a_los_destinatarios(api_as, estudiante):
    _aviso('hoy', desde='2026-10-10')
    assert api_as(estudiante).get(URL).json()[0]['estado_vigencia'] == 'VIGENTE'


def test_filtro_vigentes_del_administrador_usa_fechas_inclusivas(api_as, admin, avisos_por_fecha):
    assert _titulos(api_as(admin).get(URL, {'vigentes': 'true'})) == VISIBLES


def test_propias_solo_devuelve_los_avisos_del_administrador(api_as, admin, profesor):
    _aviso('mio', usuario_origen_id=admin.pk)
    _aviso('del-profesor', usuario_origen_id=profesor.pk)
    _aviso('sin-autor')
    assert _titulos(api_as(admin).get(URL, {'propias': 'true'})) == {'mio'}
    assert _titulos(api_as(admin).get(URL)) == {'mio', 'del-profesor', 'sin-autor'}
    assert _titulos(api_as(admin).get(URL, {'propias': 'false'})) == {'mio', 'del-profesor', 'sin-autor'}


def test_propias_no_incluye_avisos_de_otro_administrador(api_as, admin, rol_administrador):
    from usuario.tests.factories import UsuarioFactory

    otro = UsuarioFactory(persona__rol=rol_administrador)
    _aviso('del-otro', usuario_origen_id=otro.pk)
    assert _titulos(api_as(admin).get(URL, {'propias': 'true'})) == set()


def test_propias_pagina_y_cuenta_solo_los_propios(api_as, admin, profesor):
    for n in range(3):
        _aviso(f'mio-{n}', usuario_origen_id=admin.pk)
    _aviso('ajeno', usuario_origen_id=profesor.pk)
    cuerpo = api_as(admin).get(URL, {'propias': 'true', 'page': 1, 'page_size': 2}).json()
    assert cuerpo['count'] == 3 and len(cuerpo['results']) == 2
    assert 'propias=true' in cuerpo['next']


def _crear(api_as, admin, **cuerpo):
    respuesta = api_as(admin).post(URL, {'titulo': 'T', 'mensaje': 'M', **cuerpo}, format='json')
    assert respuesta.status_code == 201, respuesta.content
    return _coleccion().find_one({'_id': ObjectId(respuesta.json()['id'])})


@pytest.mark.parametrize('desde', [None, '', '2026-10-10', '2026-09-01'])
def test_alta_vigente_se_publica_al_instante(api_as, admin, publicados, desde):
    cuerpo = {} if desde is None else {'fecha_desde': desde}
    doc = _crear(api_as, admin, **cuerpo)
    assert doc['push_pendiente'] is False
    assert len(publicados) >= 1


def test_alta_programada_se_guarda_pendiente_y_no_se_publica(api_as, admin, publicados):
    doc = _crear(api_as, admin, fecha_desde='2026-10-11', fecha_hasta='2026-10-20')
    assert doc['push_pendiente'] is True
    assert doc['usuario_origen_id'] == admin.pk
    assert publicados == []


def test_fecha_hasta_es_opcional(api_as, admin, publicados):
    doc = _crear(api_as, admin, fecha_desde='2026-10-10')
    assert doc['fecha_hasta'] is None


@pytest.mark.parametrize('cuerpo', [
    {'fecha_desde': 'mañana'},
    {'fecha_hasta': '31/12/2026'},
    {'fecha_desde': '2026-13-01'},
    {'fecha_desde': '2026-10-20', 'fecha_hasta': '2026-10-19'},
])
def test_fechas_invalidas_dan_400(api_as, admin, cuerpo):
    respuesta = api_as(admin).post(URL, {'titulo': 'T', 'mensaje': 'M', **cuerpo}, format='json')
    assert respuesta.status_code == 400
    assert _coleccion().count_documents({}) == 0


def test_editar_a_fecha_futura_deja_el_envio_pendiente(api_as, admin):
    id_ = _aviso('a', push_pendiente=False)
    assert api_as(admin).put(f'{URL}{id_}/', {'fecha_desde': '2026-10-15'}, format='json').status_code == 200
    assert _coleccion().find_one({'_id': ObjectId(id_)})['push_pendiente'] is True


def test_editar_el_titulo_no_toca_la_marca(api_as, admin):
    id_ = _aviso('a', push_pendiente=False)
    api_as(admin).put(f'{URL}{id_}/', {'titulo': 'b'}, format='json')
    assert _coleccion().find_one({'_id': ObjectId(id_)})['push_pendiente'] is False


GRUPOS_ADMIN = lambda admin: f'usuario_{admin.pk}'  # noqa: E731


@pytest.mark.parametrize('alcance, roles', [
    ('TODOS', {'rol_PROFESOR', 'rol_ESTUDIANTE'}),
    ('AMBOS', {'rol_PROFESOR', 'rol_ESTUDIANTE'}),
    ('PROFESOR', {'rol_PROFESOR'}),
    ('PROFESORES', {'rol_PROFESOR'}),
    ('ESTUDIANTE', {'rol_ESTUDIANTE'}),
    ('ESTUDIANTES', {'rol_ESTUDIANTE'}),
])
def test_alcance_se_publica_a_los_grupos_de_rol(api_as, admin, publicados, alcance, roles):
    _crear(api_as, admin, alcance=alcance)
    grupos = {g for g, _, _ in publicados}
    assert grupos == roles | {f'usuario_{admin.pk}'}
    assert {t for _, t, _ in publicados} == {'notificacion.creada'}


def test_alcance_profesor_no_llega_al_grupo_de_estudiantes(api_as, admin, publicados):
    _crear(api_as, admin, alcance='PROFESOR')
    assert 'rol_ESTUDIANTE' not in {g for g, _, _ in publicados}


def test_aviso_de_materia_va_solo_al_grupo_de_la_materia(api_as, admin, materia_con_inscripcion, publicados):
    _crear(api_as, admin, alcance='ESTUDIANTES', materia_id=materia_con_inscripcion.id)
    # El titular recibe todo lo de su materia (igual que en el listado REST), además del alcance
    assert {g for g, _, _ in publicados} == {
        f'materia_{materia_con_inscripcion.id}_rol_ESTUDIANTE', f'materia_{materia_con_inscripcion.id}_rol_PROFESOR'}


@pytest.mark.parametrize('alcance, roles', [
    ('PROFESOR', {'PROFESOR'}),
    ('PROFESORES', {'PROFESOR'}),
    ('ESTUDIANTE', {'PROFESOR', 'ESTUDIANTE'}),
    ('AMBOS', {'PROFESOR', 'ESTUDIANTE'}),
    ('TODOS', {'PROFESOR', 'ESTUDIANTE'}),
])
def test_aviso_de_materia_se_publica_a_los_grupos_de_rol_de_la_materia(
        api_as, admin, materia_con_inscripcion, publicados, alcance, roles):
    _crear(api_as, admin, alcance=alcance, materia_id=materia_con_inscripcion.id)
    assert {g for g, _, _ in publicados} == {f'materia_{materia_con_inscripcion.id}_rol_{r}' for r in roles}


def test_destinatario_explicito_recibe_en_su_grupo(api_as, admin, estudiante, publicados):
    _crear(api_as, admin, alcance='PROFESOR', usuario_destino_id=estudiante.pk)
    assert {g for g, _, _ in publicados} == {'rol_PROFESOR', f'usuario_{estudiante.pk}'}


def test_payload_publicado_incluye_estado_y_fechas(api_as, admin, publicados):
    _crear(api_as, admin, fecha_desde='2026-10-10', fecha_hasta='2026-10-12')
    datos = publicados[0][2]
    assert datos['estado_vigencia'] == 'VIGENTE'
    assert datos['fecha_desde'] == '2026-10-10' and datos['fecha_hasta'] == '2026-10-12'
    assert datos['leida'] is False


def test_fallo_del_tiempo_real_no_rompe_el_alta(api_as, admin, monkeypatch):
    def falla(*args, **kwargs):
        raise RuntimeError('redis caido')

    monkeypatch.setattr('notificacion.services.publicar', falla)
    doc = _crear(api_as, admin)
    assert doc['push_pendiente'] is False


@pytest.mark.parametrize('entrada, guardado', [
    ('2026-10-10', '2026-10-10'),
    ('2026-10-10T18:30', '2026-10-10T18:30'),
    ('2026-10-10T00:00', '2026-10-10T00:00'),
])
def test_las_fechas_se_guardan_normalizadas(api_as, admin, entrada, guardado):
    doc = _crear(api_as, admin, fecha_desde=entrada, fecha_hasta='2026-12-31')
    assert doc['fecha_desde'] == guardado
    assert doc['fecha_hasta'] == '2026-12-31'


@pytest.mark.parametrize('invalida', [
    '20261005', '2026-W41-1', '2026-10-10x', '2026-10-10T18:30:00', '2026-10-10T25:00',
    '2026-10-10T18:60', '2026-10-10T', '2026-1-1', '2026-10-10T18:30Z', '2026-02-30',
])
def test_fechas_que_no_son_iso_de_calendario_dan_400(api_as, admin, invalida):
    for campo in ('fecha_desde', 'fecha_hasta'):
        respuesta = api_as(admin).post(URL, {'titulo': 'T', 'mensaje': 'M', campo: invalida}, format='json')
        assert respuesta.status_code == 400, (campo, invalida)
        assert campo in respuesta.json()
    assert _coleccion().count_documents({}) == 0


def test_editar_solo_fecha_hasta_anterior_al_desde_guardado_da_400(api_as, admin):
    id_ = _aviso('a', desde='2026-10-20', hasta='2026-10-30', push_pendiente=True)
    respuesta = api_as(admin).put(f'{URL}{id_}/', {'fecha_hasta': '2026-10-19'}, format='json')
    assert respuesta.status_code == 400
    assert _coleccion().find_one({'_id': ObjectId(id_)})['fecha_hasta'] == '2026-10-30'


def test_editar_solo_fecha_desde_posterior_al_hasta_guardado_da_400(api_as, admin):
    id_ = _aviso('a', desde='2026-10-01', hasta='2026-10-12')
    respuesta = api_as(admin).put(f'{URL}{id_}/', {'fecha_desde': '2026-10-13'}, format='json')
    assert respuesta.status_code == 400


def test_editar_con_fechas_coherentes_con_lo_guardado_funciona(api_as, admin):
    id_ = _aviso('a', desde='2026-10-01', hasta='2026-10-12', push_pendiente=False)
    assert api_as(admin).put(f'{URL}{id_}/', {'fecha_hasta': '2026-10-01'}, format='json').status_code == 200


def _pendiente(id_):
    return _coleccion().find_one({'_id': ObjectId(id_)})['push_pendiente']


def test_editar_un_pendiente_a_fecha_de_hoy_lo_publica_una_vez_y_baja_la_marca(api_as, admin, publicados):
    id_ = _aviso('a', desde='2026-10-20', push_pendiente=True, alcance='TODOS', usuario_destino_id=None)
    assert api_as(admin).put(f'{URL}{id_}/', {'fecha_desde': '2026-10-10'}, format='json').status_code == 200
    assert _pendiente(id_) is False
    assert {g for g, _, _ in publicados} == {'rol_PROFESOR', 'rol_ESTUDIANTE'}
    assert {d['id'] for _, _, d in publicados} == {id_}


def test_editar_un_pendiente_borrando_la_fecha_lo_publica_y_baja_la_marca(api_as, admin, publicados):
    id_ = _aviso('a', desde='2026-10-20', push_pendiente=True, alcance='TODOS', usuario_destino_id=None)
    assert api_as(admin).put(f'{URL}{id_}/', {'fecha_desde': None}, format='json').status_code == 200
    assert _pendiente(id_) is False
    assert len(publicados) == 2


def test_editar_un_pendiente_a_fecha_pasada_y_vencida_baja_la_marca_sin_publicar(api_as, admin, publicados):
    id_ = _aviso('a', desde='2026-10-20', push_pendiente=True, alcance='TODOS')
    cuerpo = {'fecha_desde': '2026-10-01', 'fecha_hasta': '2026-10-05'}
    assert api_as(admin).put(f'{URL}{id_}/', cuerpo, format='json').status_code == 200
    assert _pendiente(id_) is False
    assert publicados == []


def test_editar_un_ya_publicado_a_fecha_pasada_no_vuelve_a_publicar(api_as, admin, publicados):
    id_ = _aviso('a', desde='2026-10-01', push_pendiente=False, alcance='TODOS')
    assert api_as(admin).put(f'{URL}{id_}/', {'fecha_desde': '2026-10-02'}, format='json').status_code == 200
    assert _pendiente(id_) is False
    assert publicados == []


def test_fallo_al_publicar_en_la_edicion_devuelve_la_marca_para_reintentar(api_as, admin, monkeypatch):
    def falla(*args, **kwargs):
        raise RuntimeError('redis caido')

    monkeypatch.setattr('notificacion.services.publicar', falla)
    id_ = _aviso('a', desde='2026-10-20', push_pendiente=True, alcance='TODOS')
    assert api_as(admin).put(f'{URL}{id_}/', {'fecha_desde': '2026-10-10'}, format='json').status_code == 200
    assert _pendiente(id_) is True


def test_editar_a_fecha_futura_un_ya_publicado_lo_deja_pendiente(api_as, admin, publicados):
    id_ = _aviso('a', desde='2026-10-01', push_pendiente=False)
    api_as(admin).put(f'{URL}{id_}/', {'fecha_desde': '2026-11-01'}, format='json')
    assert _pendiente(id_) is True
    assert publicados == []


def test_filtro_de_vigencia_calcula_hoy_una_sola_vez(monkeypatch):
    from notificacion import services

    llamadas = []

    def contador():
        llamadas.append(1)
        return HOY

    monkeypatch.setattr(services, 'hoy', contador)
    services._filtro_vigencia()
    assert len(llamadas) == 1
