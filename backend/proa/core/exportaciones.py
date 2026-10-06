"""Utilitarios de exportación a CSV y PDF (contrato 005/exports.md y 007/exportaciones.md).

Los tres sirven a todas las exportaciones del sistema:

* ``write_csv``: UTF-8 con BOM (Excel abre bien los acentos), coma, CRLF y celdas neutralizadas
  contra inyección de fórmulas.
* ``tabla_a_pdf``: tabla con encabezado repetido y "Página X de Y", en DejaVu Sans embebida para que
  los acentos y las eñes se vean bien (las fuentes base del PDF no los cubren todos).
* ``nombre_archivo``: ``<recurso>-<AAAA-MM-DD>.<ext>``, sin caracteres que rompan la cabecera.
"""
import csv
import io
from functools import lru_cache
from pathlib import Path
from xml.sax.saxutils import escape

from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework.exceptions import ValidationError

LIMITE_FILAS_CSV = 20000
MENSAJE_LIMITE = 'Hay demasiados registros para exportar. Refine los filtros.'

# OWASP: una celda que empieza así se interpreta como fórmula en Excel y LibreOffice
PREFIJOS_DE_FORMULA = ('=', '+', '-', '@', '\t', '\r')
ESPACIOS_PREVIOS = ' \t\r\n\v\f'

DIRECTORIO_FUENTES = Path(__file__).resolve().parent / 'static' / 'fonts'
FUENTE = 'DejaVuSans'
FUENTE_NEGRITA = 'DejaVuSans-Bold'


def _celda_csv(valor):
    if valor is None:
        return ''
    # Solo los textos se neutralizan: un número negativo real (int, Decimal) no es una fórmula
    # El espacio o el salto de línea previos no la desactivan: Excel los ignora antes de evaluar
    if isinstance(valor, str) and (
        valor.startswith(PREFIJOS_DE_FORMULA) or valor.lstrip(ESPACIOS_PREVIOS).startswith(PREFIJOS_DE_FORMULA)
    ):
        return f"'{valor}"
    return valor


def nombre_archivo(recurso, ext):
    return f'{slugify(recurso)}-{timezone.localdate().isoformat()}.{ext}'


def formato_solicitado(request, permitidos=('csv', 'pdf'), defecto='csv'):
    """Lee ``?formato=``: vacío usa el defecto y cualquier valor fuera de los permitidos es 400."""
    formato = (request.query_params.get('formato') or defecto).lower()
    if formato not in permitidos:
        raise ValidationError({'detail': 'Formato no soportado.'})
    return formato


def acotar_filas(filas):
    """Materializa las filas con el mismo tope que el CSV: un PDF sin límite agota memoria y tiempo."""
    acotadas = []
    for fila in filas:
        if len(acotadas) >= LIMITE_FILAS_CSV:
            raise ValidationError({'detail': MENSAJE_LIMITE})
        acotadas.append(fila)
    return acotadas


def exportar_tabla(formato, recurso, titulo, columnas, filas, horizontal=False):
    """Responde la tabla como descarga en el formato pedido, con el nombre ``<recurso>-<fecha>.<ext>``."""
    nombre = nombre_archivo(recurso, formato)
    if formato == 'pdf':
        return tabla_a_pdf(titulo, columnas, acotar_filas(filas), horizontal=horizontal, nombre=nombre)
    return write_csv(nombre, columnas, filas)


def _respuesta(contenido_tipo, nombre):
    respuesta = HttpResponse(content_type=contenido_tipo)
    if nombre:
        respuesta['Content-Disposition'] = f'attachment; filename="{nombre}"'
    respuesta['Cache-Control'] = 'no-store'
    return respuesta


def write_csv(nombre, columnas, filas):
    respuesta = _respuesta('text/csv; charset=utf-8', nombre)
    respuesta.write('﻿')  # BOM: se codifica como EF BB BF con el charset de la respuesta
    escritor = csv.writer(respuesta)  # coma y CRLF por defecto
    escritor.writerow([_celda_csv(c) for c in columnas])
    for cantidad, fila in enumerate(filas, start=1):
        if cantidad > LIMITE_FILAS_CSV:
            raise ValidationError({'detail': MENSAJE_LIMITE})
        escritor.writerow([_celda_csv(v) for v in fila])
    return respuesta


@lru_cache(maxsize=1)
def _registrar_fuentes():
    pdfmetrics.registerFont(TTFont(FUENTE, str(DIRECTORIO_FUENTES / 'DejaVuSans.ttf')))
    pdfmetrics.registerFont(TTFont(FUENTE_NEGRITA, str(DIRECTORIO_FUENTES / 'DejaVuSans-Bold.ttf')))
    pdfmetrics.registerFontFamily(
        FUENTE, normal=FUENTE, bold=FUENTE_NEGRITA, italic=FUENTE, boldItalic=FUENTE_NEGRITA
    )


class _LienzoNumerado(canvas.Canvas):
    """Pie "Página X de Y": el total se conoce recién al terminar, por eso se guardan las páginas."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._estados = []

    def showPage(self):
        self._estados.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._estados)
        for estado in self._estados:
            self.__dict__.update(estado)
            self.setFont(FUENTE, 8)
            self.setFillColor(colors.grey)
            self.drawRightString(self._pagesize[0] - 15 * mm, 10 * mm, f'Página {self._pageNumber} de {total}')
            super().showPage()
        super().save()


def _texto(valor):
    # Paragraph interpreta marcado: el contenido del usuario se escapa siempre
    return escape('' if valor is None else str(valor))


def tabla_a_pdf(titulo, columnas, filas, horizontal=False, nombre=None):
    _registrar_fuentes()
    tamano = landscape(A4) if horizontal else A4
    margen = 15 * mm
    ancho_util = tamano[0] - 2 * margen

    estilo_titulo = ParagraphStyle('titulo', fontName=FUENTE_NEGRITA, fontSize=14, leading=18)
    estilo_fecha = ParagraphStyle('fecha', fontName=FUENTE, fontSize=8, leading=11, textColor=colors.grey)
    estilo_celda = ParagraphStyle('celda', fontName=FUENTE, fontSize=8, leading=10)
    estilo_encabezado = ParagraphStyle('encabezado', parent=estilo_celda, fontName=FUENTE_NEGRITA)

    datos = [[Paragraph(_texto(c), estilo_encabezado) for c in columnas]]
    datos += [[Paragraph(_texto(v), estilo_celda) for v in fila] for fila in filas]

    tabla = Table(datos, colWidths=[ancho_util / max(1, len(columnas))] * len(columnas), repeatRows=1)
    tabla.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E5E7EB')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#9CA3AF')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))

    emitido = timezone.localdate().strftime('%d/%m/%Y')
    historia = [
        Paragraph(_texto(titulo), estilo_titulo),
        Paragraph(f'Fecha de emisión: {emitido}', estilo_fecha),
        Spacer(1, 6 * mm),
        tabla,
    ]

    buffer = io.BytesIO()
    documento = SimpleDocTemplate(
        buffer, pagesize=tamano, title=str(titulo), author='PROA Conecta',
        leftMargin=margen, rightMargin=margen, topMargin=margen, bottomMargin=18 * mm,
    )
    documento.build(historia, canvasmaker=_LienzoNumerado)

    respuesta = _respuesta('application/pdf', nombre)
    respuesta.write(buffer.getvalue())
    return respuesta
