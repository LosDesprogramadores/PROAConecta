import io
import re

import pytest
from pypdf import PdfReader

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory, cargar_nota, crear_actividad
from aula_virtual.models import Actividad
from usuario.tests.factories import PersonaFactory

URL = '/api/materias/mi-boletin/exportar/'

pytestmark = pytest.mark.django_db


def _texto(respuesta):
    lector = PdfReader(io.BytesIO(respuesta.content))
    return '\n'.join(p.extract_text() for p in lector.pages)


@pytest.fixture
def boletin_de(estudiante):
    # Dos materias: una con dos notas (8 y 9 = 8.50) y otra sin ninguna
    algebra = MateriaFactory(titulo='Álgebra', anio=2026)
    fisica = MateriaFactory(titulo='Física', anio=2026)
    InscripcionFactory(materia=algebra, estudiante=estudiante.persona)
    InscripcionFactory(materia=fisica, estudiante=estudiante.persona)
    cargar_nota(crear_actividad(algebra, 'TP Conjuntos'), estudiante.persona, '8.00')
    cargar_nota(crear_actividad(algebra, 'Parcial 1'), estudiante.persona, '9.00')
    crear_actividad(fisica, 'Laboratorio')
    return estudiante


# --- Matriz de permisos ---

def test_estudiante_recibe_200(api_as, boletin_de):
    assert api_as(boletin_de).get(URL).status_code == 200


@pytest.mark.parametrize('rol', ['admin', 'profesor'])
def test_otros_roles_reciben_403(api_as, request, rol):
    assert api_as(request.getfixturevalue(rol)).get(URL).status_code == 403


def test_anonimo_recibe_401(cliente_anonimo):
    assert cliente_anonimo.get(URL).status_code == 401


# --- Contenido ---

def test_pdf_con_cabeceras_y_nombre_de_archivo(api_as, boletin_de):
    respuesta = api_as(boletin_de).get(URL)

    assert respuesta['Content-Type'] == 'application/pdf'
    assert respuesta.content.startswith(b'%PDF-')
    apellido = boletin_de.persona.apellido.lower()
    assert re.search(
        rf'attachment; filename="boletin-{apellido}-\d{{4}}-\d{{2}}-\d{{2}}\.pdf"', respuesta['Content-Disposition']
    )


def test_una_seccion_por_materia_con_notas_y_promedio(api_as, boletin_de):
    texto = _texto(api_as(boletin_de).get(URL))

    assert 'Boletín de calificaciones' in texto
    assert f'{boletin_de.persona.apellido}, {boletin_de.persona.nombre}' in texto
    assert 'Álgebra' in texto and 'Física' in texto
    assert 'TP Conjuntos' in texto and 'Parcial 1' in texto
    assert '8.00' in texto and '9.00' in texto
    assert 'Promedio' in texto
    assert '8.50' in texto  # el mismo calcular_promedio que usa la pantalla


def test_materia_sin_notas_dice_sin_calificaciones(api_as, boletin_de):
    assert 'Sin calificaciones' in _texto(api_as(boletin_de).get(URL))


def test_no_incluye_dni(api_as, boletin_de):
    assert boletin_de.persona.dni not in _texto(api_as(boletin_de).get(URL))


def test_la_baja_no_aparece_pero_libre_si(api_as, estudiante):
    libre = MateriaFactory(titulo='Materia Libre')
    baja = MateriaFactory(titulo='Materia Baja')
    InscripcionFactory(materia=libre, estudiante=estudiante.persona, estado=Inscripcion.EstadoInscripcion.LIBRE)
    InscripcionFactory(materia=baja, estudiante=estudiante.persona, estado=Inscripcion.EstadoInscripcion.BAJA)

    texto = _texto(api_as(estudiante).get(URL))

    assert 'Materia Libre' in texto
    assert 'Materia Baja' not in texto


def test_solo_las_notas_del_solicitante(api_as, boletin_de):
    otro = PersonaFactory(apellido='Intruso')
    materia = Inscripcion.objects.filter(estudiante=boletin_de.persona).first().materia
    InscripcionFactory(materia=materia, estudiante=otro)
    cargar_nota(crear_actividad(materia, 'Actividad del otro'), otro, '3.25')

    texto = _texto(api_as(boletin_de).get(URL))

    assert 'Intruso' not in texto
    assert '3.25' not in texto


def test_los_borradores_no_aparecen(api_as, boletin_de):
    materia = Inscripcion.objects.filter(estudiante=boletin_de.persona).first().materia
    crear_actividad(materia, 'Borrador secreto', estado=Actividad.EstadoActividad.BORRADOR)
    assert 'Borrador secreto' not in _texto(api_as(boletin_de).get(URL))


def test_las_materias_dadas_de_baja_no_aparecen(api_as, boletin_de):
    MateriaFactory(titulo='Materia Cerrada').soft_delete()
    cerrada = MateriaFactory(titulo='Materia Cerrada 2')
    InscripcionFactory(materia=cerrada, estudiante=boletin_de.persona)
    cerrada.soft_delete()
    assert 'Materia Cerrada' not in _texto(api_as(boletin_de).get(URL))


def test_resumen_final_materia_promedio(api_as, boletin_de):
    texto = _texto(api_as(boletin_de).get(URL))
    assert 'Resumen' in texto


def test_estudiante_sin_materias_obtiene_un_pdf_valido(api_as, estudiante):
    respuesta = api_as(estudiante).get(URL)
    assert respuesta.status_code == 200
    assert respuesta.content.startswith(b'%PDF-')


def test_formato_distinto_de_pdf_devuelve_400(api_as, boletin_de):
    respuesta = api_as(boletin_de).get(URL, {'formato': 'csv'})
    assert respuesta.status_code == 400
    assert respuesta.json() == {'detail': 'Formato no soportado.'}
