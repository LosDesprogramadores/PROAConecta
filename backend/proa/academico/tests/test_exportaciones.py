import csv
import io
import re

import pytest
from pypdf import PdfReader

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from usuario.tests.factories import UsuarioFactory

URL = '/api/materias/exportar/'

pytestmark = pytest.mark.django_db


def _filas(respuesta):
    return list(csv.reader(io.StringIO(respuesta.content.decode('utf-8-sig'), newline='')))


@pytest.mark.parametrize('rol, esperado', [('admin', 200), ('profesor', 403), ('estudiante', 403)])
def test_matriz_de_permisos(api_as, request, rol, esperado):
    assert api_as(request.getfixturevalue(rol)).get(URL).status_code == esperado


def test_anonimo_recibe_401(cliente_anonimo):
    assert cliente_anonimo.get(URL).status_code == 401


def test_csv_de_materias_con_inscriptos_activos(api_as, admin, profesor):
    materia = MateriaFactory(titulo='Álgebra', curso='1ro A', anio=2026, profesor=profesor.persona)
    InscripcionFactory(materia=materia)
    InscripcionFactory(materia=materia, estado=Inscripcion.EstadoInscripcion.LIBRE)
    InscripcionFactory(materia=materia, estado=Inscripcion.EstadoInscripcion.BAJA)

    respuesta = api_as(admin).get(URL, {'formato': 'csv'})

    assert respuesta.status_code == 200
    assert respuesta['Content-Type'].startswith('text/csv')
    assert re.fullmatch(
        r'attachment; filename="materias-\d{4}-\d{2}-\d{2}\.csv"', respuesta['Content-Disposition']
    )
    filas = _filas(respuesta)
    assert filas[0] == ['nombre', 'curso', 'anio', 'profesor', 'inscriptos_activos']
    # LIBRE cuenta, BAJA no
    assert filas[1][:3] == ['Álgebra', '1ro A', '2026']
    assert filas[1][3] == f'{profesor.persona.apellido}, {profesor.persona.nombre}'
    assert filas[1][4] == '2'


def test_materia_sin_profesor_deja_la_celda_vacia(api_as, admin):
    MateriaFactory(profesor=None)
    assert _filas(api_as(admin).get(URL))[1][3] == ''


def test_csv_no_incluye_materias_dadas_de_baja(api_as, admin):
    MateriaFactory(titulo='Vigente')
    MateriaFactory(titulo='Borrada').soft_delete()
    assert [f[0] for f in _filas(api_as(admin).get(URL))[1:]] == ['Vigente']


def test_el_filtro_de_profesor_se_respeta(api_as, admin, rol_profesor):
    uno = UsuarioFactory(persona__rol=rol_profesor).persona
    MateriaFactory(titulo='De uno', profesor=uno)
    MateriaFactory(titulo='De otro')
    filas = _filas(api_as(admin).get(URL, {'profesor': uno.id}))
    assert [f[0] for f in filas[1:]] == ['De uno']


def test_pdf_de_materias(api_as, admin):
    MateriaFactory(titulo='Química')
    respuesta = api_as(admin).get(URL, {'formato': 'pdf'})

    assert respuesta['Content-Type'] == 'application/pdf'
    assert respuesta.content.startswith(b'%PDF-')
    assert re.search(r'filename="materias-\d{4}-\d{2}-\d{2}\.pdf"', respuesta['Content-Disposition'])
    assert 'Química' in PdfReader(io.BytesIO(respuesta.content)).pages[0].extract_text()


def test_formato_no_soportado_devuelve_400(api_as, admin):
    respuesta = api_as(admin).get(URL, {'formato': 'docx'})
    assert respuesta.status_code == 400
    assert respuesta.json() == {'detail': 'Formato no soportado.'}


def test_la_exportacion_de_materias_no_hace_consultas_por_fila(api_as, admin, django_assert_max_num_queries, rol_profesor):
    for _ in range(8):
        materia = MateriaFactory(profesor=UsuarioFactory(persona__rol=rol_profesor).persona)
        InscripcionFactory(materia=materia)
    cliente = api_as(admin)
    with django_assert_max_num_queries(8):
        assert cliente.get(URL).status_code == 200
