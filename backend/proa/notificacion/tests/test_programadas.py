from datetime import date, datetime
from io import StringIO

import pytest
from django.core.management import call_command

from notificacion import mongo

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


def _aviso(titulo, **campos):
    doc = {'titulo': titulo, 'mensaje': 'm', 'alcance': 'TODOS', 'materia_id': None, 'usuario_destino_id': 1,
           'usuario_origen_id': 1, 'tipo_notificacion_codigo': 'GENERAL', 'fecha_creacion': datetime(2026, 1, 1),
           'leida_por': [], 'fecha_desde': '2026-10-10', 'fecha_hasta': None, 'push_pendiente': True}
    doc.update(campos)
    return _coleccion().insert_one(doc).inserted_id


def _correr():
    salida = StringIO()
    call_command('publicar_notificaciones_programadas', stdout=salida)
    return salida.getvalue()


def _pendiente(id_):
    return _coleccion().find_one({'_id': id_})['push_pendiente']


def test_publica_los_avisos_cuya_fecha_llego_y_baja_la_marca(publicados):
    id_ = _aviso('hoy')
    _correr()
    assert {g for g, _, _ in publicados} == {'rol_PROFESOR', 'rol_ESTUDIANTE', 'usuario_1'}
    assert {t for _, t, _ in publicados} == {'notificacion.creada'}
    assert publicados[0][2]['id'] == str(id_)
    assert _pendiente(id_) is False


def test_publica_avisos_con_fecha_pasada_y_fecha_con_hora(publicados):
    _aviso('pasado', fecha_desde='2026-10-01')
    _aviso('con-hora', fecha_desde='2026-10-10T23:00')
    _correr()
    assert {d['titulo'] for _, _, d in publicados} == {'pasado', 'con-hora'}


def test_no_publica_los_de_fecha_futura(publicados):
    id_ = _aviso('futuro', fecha_desde='2026-10-11')
    _correr()
    assert publicados == []
    assert _pendiente(id_) is True


def test_ignora_avisos_sin_marca_o_ya_publicados(publicados):
    _aviso('ya-publicado', push_pendiente=False)
    _coleccion().insert_one({'titulo': 'viejo', 'alcance': 'AMBOS', 'fecha_desde': None})
    _correr()
    assert publicados == []


def test_correr_dos_veces_no_duplica_el_envio(publicados):
    _aviso('uno')
    _correr()
    cantidad = len(publicados)
    assert cantidad > 0
    _correr()
    assert len(publicados) == cantidad


def test_un_aviso_ya_reclamado_por_otra_ejecucion_no_se_vuelve_a_publicar(publicados, monkeypatch):
    from notificacion.management.commands import publicar_notificaciones_programadas as comando

    id_ = _aviso('carrera')
    original = comando.pendientes

    def con_otro_proceso_ganando(*args, **kwargs):
        ids = list(original(*args, **kwargs))
        _coleccion().update_one({'_id': id_}, {'$set': {'push_pendiente': False}})  # otro proceso lo reclamó
        return ids

    monkeypatch.setattr(comando, 'pendientes', con_otro_proceso_ganando)
    _correr()
    assert publicados == []


def test_fallo_del_tiempo_real_conserva_la_marca_y_reintenta(publicados, monkeypatch, caplog):
    id_ = _aviso('reintento')
    envio = {'falla': True}

    def inestable(grupo, tipo, datos):
        if envio['falla']:
            raise ConnectionError('redis caido')
        publicados.append((grupo, tipo, datos))

    monkeypatch.setattr('notificacion.services.publicar', inestable)
    _correr()
    assert _pendiente(id_) is True
    assert publicados == []
    assert 'reintento' in caplog.text or str(id_) in caplog.text

    envio['falla'] = False
    _correr()
    assert _pendiente(id_) is False
    assert len(publicados) > 0


def test_un_fallo_no_impide_publicar_los_demas(publicados, monkeypatch):
    primero = _aviso('falla')
    segundo = _aviso('anda')

    def selectivo(grupo, tipo, datos):
        if datos['titulo'] == 'falla':
            raise ConnectionError('boom')
        publicados.append((grupo, tipo, datos))

    monkeypatch.setattr('notificacion.services.publicar', selectivo)
    _correr()
    assert _pendiente(primero) is True
    assert _pendiente(segundo) is False


def test_informa_la_cantidad_publicada(publicados):
    _aviso('a')
    _aviso('b')
    assert '2' in _correr()
    assert 'Sin avisos' in _correr()


def test_no_publica_un_aviso_ya_vencido_y_baja_la_marca(publicados):
    vencido = _aviso('vencido', fecha_desde='2026-10-01', fecha_hasta='2026-10-09')
    _correr()
    assert publicados == []
    assert _pendiente(vencido) is False


def test_publica_si_el_ultimo_dia_es_hoy_o_no_hay_fecha_hasta(publicados):
    _aviso('hasta-hoy', fecha_hasta='2026-10-10')
    _aviso('hasta-hoy-con-hora', fecha_hasta='2026-10-10T00:00')
    _aviso('hasta-vacio', fecha_hasta='')
    _aviso('hasta-futuro', fecha_hasta='2026-12-31')
    _correr()
    assert {d['titulo'] for _, _, d in publicados} == {'hasta-hoy', 'hasta-hoy-con-hora', 'hasta-vacio', 'hasta-futuro'}


def test_reclamar_no_entrega_un_aviso_vencido():
    from notificacion import services

    id_ = _aviso('vencido', fecha_desde='2026-10-01', fecha_hasta='2026-10-09')
    assert services.reclamar(id_) is None
    assert services.pendientes_de_publicar() == []

