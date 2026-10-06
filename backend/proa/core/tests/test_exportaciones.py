import csv
import datetime
import io
from decimal import Decimal

import pytest
from pypdf import PdfReader
from rest_framework.exceptions import ValidationError

from core import exportaciones
from core.exportaciones import nombre_archivo, tabla_a_pdf, write_csv

BOM = b'\xef\xbb\xbf'


def _filas_csv(respuesta):
    texto = respuesta.content.decode('utf-8-sig')
    return list(csv.reader(io.StringIO(texto, newline='')))


def _texto_pdf(respuesta):
    lector = PdfReader(io.BytesIO(respuesta.content))
    return '\n'.join(pagina.extract_text() for pagina in lector.pages), lector


# --- CSV ---

def test_csv_empieza_con_bom_utf8_y_conserva_los_acentos():
    respuesta = write_csv('materias.csv', ['nombre', 'año'], [['Matemática', 2026], ['Física', 2025]])

    assert respuesta.content.startswith(BOM)
    assert _filas_csv(respuesta) == [['nombre', 'año'], ['Matemática', '2026'], ['Física', '2025']]


def test_csv_cabeceras_de_la_descarga():
    respuesta = write_csv('estudiantes-2026-10-06.csv', ['a'], [['x']])

    assert respuesta['Content-Type'] == 'text/csv; charset=utf-8'
    assert respuesta['Content-Disposition'] == 'attachment; filename="estudiantes-2026-10-06.csv"'
    assert respuesta['Cache-Control'] == 'no-store'


def test_csv_usa_coma_y_fin_de_linea_crlf():
    respuesta = write_csv('a.csv', ['a', 'b'], [['1', '2']])

    assert respuesta.content.decode('utf-8-sig') == 'a,b\r\n1,2\r\n'


@pytest.mark.parametrize('inicio', ['=', '+', '-', '@', '\t', '\r'])
def test_csv_neutraliza_celdas_que_parecen_formulas(inicio):
    peligrosa = f'{inicio}CMD()'

    respuesta = write_csv('a.csv', ['dato'], [[peligrosa]])

    assert _filas_csv(respuesta)[1] == [f"'{peligrosa}"]


def test_csv_neutraliza_tambien_los_encabezados():
    respuesta = write_csv('a.csv', ['=HYPERLINK("http://x")'], [])

    assert _filas_csv(respuesta)[0][0].startswith("'=")


def test_csv_no_toca_valores_comunes_ni_numeros_negativos():
    filas = [['Pérez, Ana', 'a=b', 'x-y', -5, Decimal('-1.50'), None, True]]

    respuesta = write_csv('a.csv', ['1', '2', '3', '4', '5', '6', '7'], filas)

    assert _filas_csv(respuesta)[1] == ['Pérez, Ana', 'a=b', 'x-y', '-5', '-1.50', '', 'True']


def test_csv_escapa_comillas_y_saltos_de_linea_dentro_de_la_celda():
    respuesta = write_csv('a.csv', ['t'], [['dijo "hola"\nchau']])

    assert _filas_csv(respuesta)[1] == ['dijo "hola"\nchau']


def test_csv_sin_filas_trae_solo_el_encabezado():
    assert _filas_csv(write_csv('a.csv', ['a', 'b'], [])) == [['a', 'b']]


def test_csv_acepta_un_generador_de_filas():
    respuesta = write_csv('a.csv', ['n'], ([i] for i in range(3)))

    assert _filas_csv(respuesta)[1:] == [['0'], ['1'], ['2']]


def test_csv_corta_con_400_si_supera_el_limite(monkeypatch):
    monkeypatch.setattr(exportaciones, 'LIMITE_FILAS_CSV', 2)

    with pytest.raises(ValidationError) as error:
        write_csv('a.csv', ['n'], [[1], [2], [3]])

    assert error.value.detail == {'detail': 'Hay demasiados registros para exportar. Refine los filtros.'}


# --- PDF ---

def test_pdf_empieza_con_la_firma_y_tiene_las_cabeceras():
    respuesta = tabla_a_pdf('Materias', ['nombre'], [['Álgebra']], nombre='materias-2026-10-06.pdf')

    assert respuesta.content.startswith(b'%PDF-')
    assert respuesta['Content-Type'] == 'application/pdf'
    assert respuesta['Content-Disposition'] == 'attachment; filename="materias-2026-10-06.pdf"'
    assert respuesta['Cache-Control'] == 'no-store'


def test_pdf_muestra_los_acentos_y_las_enies():
    respuesta = tabla_a_pdf(
        'Listado de Matemática', ['Año', 'Profesor'], [['Introducción', 'Núñez, José'], ['Física', 'Peña']]
    )

    texto, _ = _texto_pdf(respuesta)

    for esperado in ('Matemática', 'Año', 'Introducción', 'Núñez, José', 'Física', 'Peña'):
        assert esperado in texto


def test_pdf_embebe_dejavu_sans():
    respuesta = tabla_a_pdf('t', ['a'], [['é']])

    assert b'DejaVuSans' in respuesta.content


def test_pdf_lleva_titulo_fecha_de_emision_y_pie_de_pagina(monkeypatch):
    monkeypatch.setattr(exportaciones.timezone, 'localdate', lambda: datetime.date(2026, 10, 6))

    texto, _ = _texto_pdf(tabla_a_pdf('Estudiantes', ['a'], [['x']]))

    assert 'Estudiantes' in texto
    assert '06/10/2026' in texto
    assert 'Página 1 de 1' in texto


def test_pdf_con_muchas_filas_pagina_y_repite_el_encabezado():
    filas = [[f'Persona {i}', f'correo{i}@ejemplo.test'] for i in range(150)]

    texto, lector = _texto_pdf(tabla_a_pdf('Personas', ['Apellido', 'Correo'], filas))

    total = len(lector.pages)
    assert total > 1
    assert f'Página {total} de {total}' in texto
    assert all('Apellido' in pagina.extract_text() for pagina in lector.pages)


def test_pdf_horizontal_es_mas_ancho_que_alto():
    vertical = PdfReader(io.BytesIO(tabla_a_pdf('t', ['a'], [['x']]).content)).pages[0].mediabox
    horizontal = PdfReader(io.BytesIO(tabla_a_pdf('t', ['a'], [['x']], horizontal=True).content)).pages[0].mediabox

    assert vertical.height > vertical.width
    assert horizontal.width > horizontal.height


def test_pdf_no_interpreta_marcado_en_las_celdas():
    respuesta = tabla_a_pdf('<b>Titulo</b>', ['a'], [['<i>x</i> & <script>']])

    texto, _ = _texto_pdf(respuesta)

    assert '<i>x</i> & <script>' in texto
    assert '<b>Titulo</b>' in texto


def test_pdf_sin_filas_sigue_siendo_valido():
    texto, lector = _texto_pdf(tabla_a_pdf('Vacío', ['a', 'b'], []))

    assert len(lector.pages) == 1
    assert 'Vacío' in texto


def test_pdf_celdas_none_salen_vacias():
    respuesta = tabla_a_pdf('t', ['a', 'b'], [[None, 3]])

    texto, _ = _texto_pdf(respuesta)

    assert 'None' not in texto


# --- nombre_archivo ---

def test_nombre_archivo_lleva_recurso_fecha_y_extension(monkeypatch):
    monkeypatch.setattr(exportaciones.timezone, 'localdate', lambda: datetime.date(2026, 10, 6))

    assert nombre_archivo('estudiantes', 'csv') == 'estudiantes-2026-10-06.csv'


def test_nombre_archivo_limpia_acentos_espacios_y_caracteres_peligrosos(monkeypatch):
    monkeypatch.setattr(exportaciones.timezone, 'localdate', lambda: datetime.date(2026, 10, 6))

    nombre = nombre_archivo('Matemática I / "2do" A\r\n', 'pdf')

    assert nombre == 'matematica-i-2do-a-2026-10-06.pdf'

@pytest.mark.parametrize('valor', ['\n=CMD()', ' =CMD()', '  \t@x', '\r\n+1+1', ' -2+3'])
def test_formulas_con_espacio_o_salto_previo_se_neutralizan(valor):
    respuesta = write_csv('a.csv', ['dato'], [[valor]])
    assert _filas_csv(respuesta)[1][0] == f"'{valor}"


def test_texto_con_espacio_previo_sin_formula_no_se_toca():
    assert _filas_csv(write_csv('a.csv', ['dato'], [['  hola']]))[1][0] == '  hola'


def test_exportar_tabla_pdf_respeta_el_limite_de_filas(monkeypatch):
    monkeypatch.setattr(exportaciones, 'LIMITE_FILAS_CSV', 2)
    with pytest.raises(ValidationError) as error:
        exportaciones.exportar_tabla('pdf', 'x', 'X', ['n'], ([i] for i in range(3)))
    assert error.value.detail == {'detail': 'Hay demasiados registros para exportar. Refine los filtros.'}



def test_pdf_con_subtitulo_lo_muestra_bajo_el_titulo():
    texto, _ = _texto_pdf(tabla_a_pdf('Calificaciones', ['a'], [['x']], subtitulo='Docente titular: Pérez, Ana'))
    assert 'Docente titular: Pérez, Ana' in texto
