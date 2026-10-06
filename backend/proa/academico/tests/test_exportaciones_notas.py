import csv
import io
import re

import pytest
from pypdf import PdfReader

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory, cargar_nota, crear_actividad
from aula_virtual.models import Actividad
from usuario.tests.factories import PersonaFactory, UsuarioFactory

pytestmark = pytest.mark.django_db


def _url(materia):
    return f'/api/materias/{materia.id}/rendimiento-curso/exportar/'


def _filas(respuesta):
    return list(csv.reader(io.StringIO(respuesta.content.decode('utf-8-sig'), newline='')))


def _texto_pdf(respuesta):
    lector = PdfReader(io.BytesIO(respuesta.content))
    return '\n'.join(p.extract_text() for p in lector.pages), lector


@pytest.fixture
def curso(profesor):
    # Materia con 3 estudiantes y 2 actividades publicadas
    materia = MateriaFactory(titulo='Álgebra', curso='1ro A', anio=2026, profesor=profesor.persona)
    a1 = crear_actividad(materia, 'TP 1')
    a2 = crear_actividad(materia, 'Parcial')
    ana = PersonaFactory(apellido='Alvarez', nombre='Ana')
    beto = PersonaFactory(apellido='Benitez', nombre='Beto')
    cami = PersonaFactory(apellido='Castro', nombre='Cami')
    for persona in (ana, beto, cami):
        InscripcionFactory(materia=materia, estudiante=persona)
    cargar_nota(a1, ana, '8.00')
    cargar_nota(a2, ana, '9.00')
    cargar_nota(a1, beto, '4.50')
    return materia


# --- Matriz de permisos ---

def test_admin_recibe_200(api_as, admin, curso):
    assert api_as(admin).get(_url(curso)).status_code == 200


def test_profesor_titular_recibe_200(api_as, profesor, curso):
    assert api_as(profesor).get(_url(curso)).status_code == 200


def test_profesor_ajeno_recibe_404(api_as, rol_profesor, curso):
    ajeno = UsuarioFactory(persona__rol=rol_profesor)
    assert api_as(ajeno).get(_url(curso)).status_code == 404


def test_estudiante_inscripto_recibe_403(api_as, estudiante, curso):
    InscripcionFactory(materia=curso, estudiante=estudiante.persona)
    assert api_as(estudiante).get(_url(curso)).status_code == 403


def test_estudiante_no_inscripto_recibe_404(api_as, estudiante, curso):
    assert api_as(estudiante).get(_url(curso)).status_code == 404


def test_anonimo_recibe_401(cliente_anonimo, curso):
    assert cliente_anonimo.get(_url(curso)).status_code == 401


def test_materia_inexistente_recibe_404(api_as, admin):
    assert api_as(admin).get('/api/materias/99999/rendimiento-curso/exportar/').status_code == 404


# --- CSV ---

def test_csv_coincide_con_el_servicio(api_as, profesor, curso):
    respuesta = api_as(profesor).get(_url(curso), {'formato': 'csv'})

    assert respuesta['Content-Type'].startswith('text/csv')
    assert re.fullmatch(
        r'attachment; filename="calificaciones-algebra-\d{4}-\d{2}-\d{2}\.csv"', respuesta['Content-Disposition']
    )
    filas = _filas(respuesta)
    assert filas[0] == ['apellido', 'nombre', 'TP 1', 'Parcial', 'promedio']
    assert filas[1:] == [
        ['Alvarez', 'Ana', '8.00', '9.00', '8.50'],
        ['Benitez', 'Beto', '4.50', '', '4.50'],
        ['Castro', 'Cami', '', '', ''],
    ]


def test_formato_por_defecto_es_csv(api_as, profesor, curso):
    assert api_as(profesor).get(_url(curso))['Content-Type'].startswith('text/csv')


def test_csv_no_incluye_dni(api_as, profesor, curso):
    contenido = api_as(profesor).get(_url(curso)).content.decode('utf-8-sig')
    assert 'dni' not in contenido.lower().split('\r\n')[0]


def test_baja_se_excluye_y_libre_se_incluye(api_as, profesor, curso):
    InscripcionFactory(materia=curso, estudiante=PersonaFactory(apellido='Dávila'),
                       estado=Inscripcion.EstadoInscripcion.LIBRE)
    InscripcionFactory(materia=curso, estudiante=PersonaFactory(apellido='Echeverría'),
                       estado=Inscripcion.EstadoInscripcion.BAJA)

    apellidos = [f[0] for f in _filas(api_as(profesor).get(_url(curso)))[1:]]

    assert 'Dávila' in apellidos
    assert 'Echeverría' not in apellidos


def test_los_borradores_no_son_columnas(api_as, profesor, curso):
    crear_actividad(curso, 'Borrador oculto', estado=Actividad.EstadoActividad.BORRADOR)
    assert 'Borrador oculto' not in _filas(api_as(profesor).get(_url(curso)))[0]


def test_celda_con_formula_se_neutraliza(api_as, profesor, curso):
    InscripcionFactory(materia=curso, estudiante=PersonaFactory(apellido='Zeta', nombre='=CMD()'))
    filas = _filas(api_as(profesor).get(_url(curso)))
    assert ["Zeta", "'=CMD()"] == filas[-1][:2]


def test_materia_sin_entregas_trae_estudiantes_y_encabezados(api_as, profesor):
    materia = MateriaFactory(profesor=profesor.persona)
    crear_actividad(materia, 'TP 1')
    InscripcionFactory(materia=materia, estudiante=PersonaFactory(apellido='Solo', nombre='Uno'))

    filas = _filas(api_as(profesor).get(_url(materia)))

    assert filas == [['apellido', 'nombre', 'TP 1', 'promedio'], ['Solo', 'Uno', '', '']]


# --- PDF ---

def test_pdf_horizontal_con_materia_docente_y_notas(api_as, profesor, curso):
    respuesta = api_as(profesor).get(_url(curso), {'formato': 'pdf'})

    assert respuesta.status_code == 200
    assert respuesta['Content-Type'] == 'application/pdf'
    assert respuesta.content.startswith(b'%PDF-')
    assert re.search(r'filename="calificaciones-algebra-\d{4}-\d{2}-\d{2}\.pdf"', respuesta['Content-Disposition'])
    texto, lector = _texto_pdf(respuesta)
    ancho, alto = lector.pages[0].mediabox.width, lector.pages[0].mediabox.height
    assert ancho > alto  # A4 horizontal
    assert 'Álgebra' in texto
    assert f'{profesor.persona.apellido}, {profesor.persona.nombre}' in texto
    assert 'Alvarez, Ana' in texto
    assert '8.50' in texto
    assert 'Promedio' in texto


def test_pdf_no_incluye_dni(api_as, profesor, curso):
    dni = Inscripcion.objects.filter(materia=curso).first().estudiante.dni
    texto, _ = _texto_pdf(api_as(profesor).get(_url(curso), {'formato': 'pdf'}))
    assert dni not in texto


def test_formato_no_soportado_devuelve_400(api_as, profesor, curso):
    respuesta = api_as(profesor).get(_url(curso), {'formato': 'xlsx'})
    assert respuesta.status_code == 400
    assert respuesta.json() == {'detail': 'Formato no soportado.'}
