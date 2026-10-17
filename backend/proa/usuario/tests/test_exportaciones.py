import csv
import io
import re

import pytest
from pypdf import PdfReader

from academico.tests.factories import MateriaFactory
from usuario.tests.factories import PersonaFactory, UsuarioFactory

URL = '/api/personas/exportar/'

pytestmark = pytest.mark.django_db


def _filas(respuesta):
    return list(csv.reader(io.StringIO(respuesta.content.decode('utf-8-sig'), newline='')))


def _nombre(respuesta):
    return re.search(r'filename="([^"]+)"', respuesta['Content-Disposition']).group(1)


@pytest.mark.parametrize('rol, esperado', [
    ('admin', 200), ('profesor', 403), ('estudiante', 403),
])
def test_matriz_de_permisos(api_as, request, rol, esperado, rol_estudiante):
    usuario = request.getfixturevalue(rol)
    respuesta = api_as(usuario).get(URL, {'rol': rol_estudiante.id})
    assert respuesta.status_code == esperado


def test_anonimo_recibe_401(cliente_anonimo):
    assert cliente_anonimo.get(URL).status_code == 401


def test_csv_de_estudiantes_con_nombre_de_archivo_y_cabeceras(api_as, admin, rol_estudiante):
    PersonaFactory(rol=rol_estudiante, apellido='Pérez', nombre='Ana', dni='40000001', email='ana@ejemplo.test')
    respuesta = api_as(admin).get(URL, {'rol': rol_estudiante.id, 'formato': 'csv'})

    assert respuesta.status_code == 200
    assert respuesta['Content-Type'].startswith('text/csv')
    assert re.fullmatch(r'estudiantes-\d{4}-\d{2}-\d{2}\.csv', _nombre(respuesta))
    assert respuesta['Content-Disposition'].startswith('attachment;')
    filas = _filas(respuesta)
    assert filas[0] == ['dni', 'apellido', 'nombre', 'email', 'tel_contacto', 'activo', 'fecha_alta']
    assert ['40000001', 'Pérez', 'Ana', 'ana@ejemplo.test'] == filas[1][:4]


def test_formato_por_defecto_es_csv(api_as, admin, rol_estudiante):
    respuesta = api_as(admin).get(URL, {'rol': rol_estudiante.id})
    assert respuesta['Content-Type'].startswith('text/csv')


def test_csv_de_profesores_incluye_materias_asignadas(api_as, admin, rol_profesor):
    profesor = UsuarioFactory(persona__rol=rol_profesor).persona
    MateriaFactory(profesor=profesor, titulo='Álgebra')
    MateriaFactory(profesor=profesor, titulo='Física', curso='2do B')

    respuesta = api_as(admin).get(URL, {'rol': rol_profesor.id, 'formato': 'csv'})

    assert re.fullmatch(r'profesores-\d{4}-\d{2}-\d{2}\.csv', _nombre(respuesta))
    filas = _filas(respuesta)
    assert filas[0][-1] == 'materias_asignadas'
    assert set(filas[1][-1].split('; ')) == {'Álgebra', 'Física'}


def test_el_csv_excluye_personas_dadas_de_baja_y_otros_roles(api_as, admin, rol_estudiante, rol_profesor):
    PersonaFactory(rol=rol_estudiante, apellido='Activa')
    baja = PersonaFactory(rol=rol_estudiante, apellido='Eliminada')
    baja.soft_delete()
    PersonaFactory(rol=rol_profesor, apellido='Docente')

    filas = _filas(api_as(admin).get(URL, {'rol': rol_estudiante.id}))

    assert [f[1] for f in filas[1:]] == ['Activa']


def test_el_csv_neutraliza_formulas(api_as, admin, rol_estudiante):
    PersonaFactory(rol=rol_estudiante, nombre='=CMD()')
    filas = _filas(api_as(admin).get(URL, {'rol': rol_estudiante.id}))
    assert filas[1][2] == "'=CMD()"


def test_pdf_de_estudiantes_no_incluye_dni_ni_telefono(api_as, admin, rol_estudiante):
    PersonaFactory(rol=rol_estudiante, apellido='Gómez', dni='41999888', tel_contacto='3815551234')
    respuesta = api_as(admin).get(URL, {'rol': rol_estudiante.id, 'formato': 'pdf'})

    assert respuesta.status_code == 200
    assert respuesta['Content-Type'] == 'application/pdf'
    assert respuesta.content.startswith(b'%PDF-')
    assert re.fullmatch(r'estudiantes-\d{4}-\d{2}-\d{2}\.pdf', _nombre(respuesta))
    texto = '\n'.join(p.extract_text() for p in PdfReader(io.BytesIO(respuesta.content)).pages)
    assert 'Gómez' in texto
    assert '41999888' not in texto and '3815551234' not in texto


def test_formato_no_soportado_devuelve_400_con_detail(api_as, admin, rol_estudiante):
    respuesta = api_as(admin).get(URL, {'rol': rol_estudiante.id, 'formato': 'xlsx'})
    assert respuesta.status_code == 400
    assert respuesta.json() == {'detail': 'Formato no soportado.'}


def test_rol_inexistente_devuelve_400(api_as, admin):
    respuesta = api_as(admin).get(URL, {'rol': 9999})
    assert respuesta.status_code == 400
    assert 'detail' in respuesta.json()


def test_sin_rol_exporta_todas_las_personas_activas_como_personas(api_as, admin):
    respuesta = api_as(admin).get(URL)
    assert respuesta.status_code == 200
    assert re.fullmatch(r'personas-\d{4}-\d{2}-\d{2}\.csv', _nombre(respuesta))


def test_cors_expone_content_disposition_para_leer_el_nombre_del_archivo():
    from django.conf import settings
    assert 'Content-Disposition' in settings.CORS_EXPOSE_HEADERS
