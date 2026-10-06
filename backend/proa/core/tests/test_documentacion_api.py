"""Documentación de la API (SEC-25): abierta en desarrollo, apagada en producción y en los tests."""
import pytest

from core.tests.test_settings import ENTORNO_PROD, importar

RUTAS = ('/api/schema/', '/api/schema/swagger-ui/', '/api/schema/redoc/')


@pytest.mark.django_db
@pytest.mark.parametrize('ruta', RUTAS)
def test_con_docs_publicas_cualquiera_las_ve(cliente_anonimo, settings, ruta):
    settings.DOCS_API_PUBLICAS = True

    assert cliente_anonimo.get(ruta).status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize('ruta', RUTAS)
def test_sin_docs_publicas_ni_el_administrador_las_ve(cliente_anonimo, api_as, admin, settings, ruta):
    settings.DOCS_API_PUBLICAS = False

    assert cliente_anonimo.get(ruta).status_code == 404
    assert api_as(admin).get(ruta).status_code == 404


def test_solo_el_modo_desarrollo_enciende_la_documentacion():
    assert importar('proa.settings.dev', {}).DOCS_API_PUBLICAS is True
    assert importar('proa.settings.prod', ENTORNO_PROD).DOCS_API_PUBLICAS is False
    assert importar('proa.settings.test', {}).DOCS_API_PUBLICAS is False
