"""GET /api/health/ (009/T022, FR-019): estado de PostgreSQL, MongoDB y Redis sin datos sensibles."""
import logging
from unittest import mock

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from core import salud
from core.tests.test_settings import ENTORNO_PROD, importar

URL = '/api/health/'


@pytest.fixture(autouse=True)
def _sin_cache_ni_cliente():
    # El resultado y el cliente de Mongo viven a nivel de módulo: cada test parte de cero
    salud.reiniciar()
    yield
    salud.reiniciar()


@pytest.fixture
def cliente():
    return APIClient()


def test_todo_ok_responde_200_sin_token(cliente, db):
    r = cliente.get(URL)
    assert r.status_code == 200
    assert r.json() == {'estado': 'ok', 'servicios': {'postgres': 'ok', 'mongo': 'ok', 'redis': 'no_configurado'}}


def test_con_redis_configurado_lo_chequea(cliente, db):
    with override_settings(REDIS_URL='redis://redis:6379/0'):
        r = cliente.get(URL)
    assert r.status_code == 200
    assert r.json()['servicios']['redis'] == 'ok'


def test_redis_caido_degrada_pero_responde_200(cliente, db):
    with override_settings(REDIS_URL='redis://redis:6379/0'), \
            mock.patch.object(salud.cache, 'set', side_effect=ConnectionError('redis://secreto@10.0.0.5')):
        r = cliente.get(URL)
    assert r.status_code == 200
    assert r.json() == {'estado': 'degradado',
                        'servicios': {'postgres': 'ok', 'mongo': 'ok', 'redis': 'error'}}


def test_mongo_caido_degrada_pero_responde_200(cliente, db):
    with mock.patch.object(salud.pymongo, 'MongoClient', side_effect=RuntimeError('mongodb://u:p@10.0.0.9')):
        r = cliente.get(URL)
    assert r.status_code == 200
    assert r.json()['estado'] == 'degradado'
    assert r.json()['servicios']['mongo'] == 'error'


def test_postgres_caido_responde_503(cliente, db):
    with mock.patch.object(salud.connection, 'cursor', side_effect=RuntimeError('host=10.0.0.1 password=x')):
        r = cliente.get(URL)
    assert r.status_code == 503
    assert r.json() == {'estado': 'caido', 'servicios': {'postgres': 'error', 'mongo': 'ok', 'redis': 'no_configurado'}}


def test_la_respuesta_no_filtra_hosts_versiones_ni_errores(cliente, db):
    with mock.patch.object(salud.connection, 'cursor', side_effect=RuntimeError('host=10.0.0.1 password=x')), \
            mock.patch.object(salud.pymongo, 'MongoClient', side_effect=RuntimeError('mongodb://u:p@10.0.0.9')):
        texto = cliente.get(URL).content.decode()
    for prohibido in ('10.0.0', 'password', 'mongodb://', 'sqlite', 'postgres://', 'version'):
        assert prohibido not in texto


def test_el_error_se_registra_como_warning_solo_con_la_clase(cliente, db, caplog):
    with caplog.at_level(logging.WARNING, logger='core.salud'), \
            mock.patch.object(salud.connection, 'cursor', side_effect=RuntimeError('boom host=10.0.0.1')):
        cliente.get(URL)
    registro = next(r for r in caplog.records if r.name == 'core.salud')
    assert registro.levelno == logging.WARNING
    assert 'PostgreSQL' in registro.getMessage()
    assert 'RuntimeError' in registro.getMessage()
    assert 'boom' not in registro.getMessage()
    assert not registro.exc_info


def test_el_resultado_se_reutiliza_dentro_del_ttl(cliente, db):
    with mock.patch.object(salud, '_postgres', return_value='ok') as pg:
        primero = cliente.get(URL).json()
        segundo = cliente.get(URL).json()
    assert primero == segundo
    assert pg.call_count == 1


def test_el_resultado_se_recalcula_al_vencer_el_ttl(cliente, db):
    with mock.patch.object(salud, '_postgres', return_value='ok') as pg, \
            mock.patch.object(salud.time, 'monotonic', side_effect=[100.0, 100.0, 100.0 + salud.TTL_SEGUNDOS + 1,
                                                                    100.0 + salud.TTL_SEGUNDOS + 1]):
        cliente.get(URL)
        cliente.get(URL)
    assert pg.call_count == 2


def test_el_cliente_de_mongo_se_crea_una_sola_vez(cliente, db):
    real = salud.pymongo.MongoClient
    with mock.patch.object(salud.pymongo, 'MongoClient', side_effect=real) as ctor:
        cliente.get(URL)
        salud._cache = None  # fuerza un segundo chequeo sin esperar el TTL
        cliente.get(URL)
    assert ctor.call_count == 1
    assert ctor.call_args.kwargs['serverSelectionTimeoutMS'] == salud.MONGO_TIMEOUT_MS


def test_un_jwt_invalido_no_tumba_el_healthcheck(cliente, db):
    cliente.credentials(HTTP_AUTHORIZATION='Bearer token-roto')
    assert cliente.get(URL).status_code == 200


def test_prod_exime_el_healthcheck_de_la_redireccion_https():
    s = importar('proa.settings.prod', {**ENTORNO_PROD, 'DJANGO_SECURE_SSL_REDIRECT': 'true'})
    assert s.SECURE_SSL_REDIRECT is True
    assert s.SECURE_REDIRECT_EXEMPT == [r'^api/health/$']


def test_logging_usa_django_log_level():
    s = importar('proa.settings.base', {'DJANGO_LOG_LEVEL': 'debug'})
    assert s.LOGGING['root']['level'] == 'DEBUG'
    assert s.LOGGING['loggers']['django']['level'] == 'DEBUG'
    assert s.LOGGING['handlers']['consola']['class'] == 'logging.StreamHandler'
    assert 'levelname' in s.LOGGING['formatters']['estructurado']['format']


def test_logging_por_defecto_es_info():
    assert importar('proa.settings.base', {}).LOGGING['root']['level'] == 'INFO'


def test_la_suite_corre_con_logging_en_warning():
    s = importar('proa.settings.test', {'DJANGO_LOG_LEVEL': 'DEBUG'})
    assert s.LOGGING['root']['level'] == 'WARNING'
