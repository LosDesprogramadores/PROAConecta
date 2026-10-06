"""Validación de archivos subidos (X-12, T056): extensión permitida, tamaño máximo y firma del contenido.

La extensión la elige quien sube el archivo, así que no alcanza: para los tipos con firma conocida
se lee el comienzo del contenido y debe coincidir. No reemplaza un antivirus; evita lo barato
(un ``.html`` renombrado a ``.pdf``, un ejecutable, un archivo gigante).

Los archivos subidos antes de este cambio no se vuelven a validar (la regla corre solo al subir): se acepta
ese riesgo; siguen descargándose solo con autorización y como adjunto (aula_virtual/descargas.py).
"""
import os

from django.core.exceptions import ValidationError

TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024  # 10 MB; nginx acepta hasta 20 MB de cuerpo para cubrir el multipart

PDF = (b'%PDF-',)
ZIP = (b'PK\x03\x04', b'PK\x05\x06')  # docx, xlsx y pptx son contenedores zip
FIRMAS = {
    '.pdf': PDF,
    '.png': (b'\x89PNG\r\n\x1a\n',),
    '.jpg': (b'\xff\xd8\xff',),
    '.jpeg': (b'\xff\xd8\xff',),
    '.zip': ZIP,
    '.docx': ZIP,
    '.xlsx': ZIP,
    '.pptx': ZIP,
}
EXTENSIONES_PERMITIDAS = frozenset({*FIRMAS, '.txt'})
BYTES_A_LEER = 8192


def _comienzo(archivo) -> bytes:
    archivo.seek(0)
    try:
        return archivo.read(BYTES_A_LEER)
    finally:
        archivo.seek(0)


def validar_archivo(archivo) -> None:
    """Rechaza (``ValidationError``, 400 en la API) extensión, tamaño o contenido no permitidos."""
    if getattr(archivo, '_committed', False):
        return  # archivo ya guardado (FieldFile sin cambios): solo se validan las subidas nuevas

    extension = os.path.splitext(archivo.name or '')[1].lower()
    if extension not in EXTENSIONES_PERMITIDAS:
        permitidas = ', '.join(sorted(e.lstrip('.') for e in EXTENSIONES_PERMITIDAS))
        raise ValidationError(f'El tipo de archivo no está permitido. Formatos aceptados: {permitidas}.')

    if archivo.size > TAMANO_MAXIMO_BYTES:
        raise ValidationError(f'El archivo supera el tamaño máximo de {TAMANO_MAXIMO_BYTES // (1024 * 1024)} MB.')

    comienzo = _comienzo(archivo)
    if extension == '.txt':
        coincide = b'\x00' not in comienzo
    else:
        coincide = comienzo.startswith(FIRMAS[extension])
    if not coincide:
        raise ValidationError('El contenido del archivo no coincide con su extensión.')
