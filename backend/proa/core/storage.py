"""Nombres de archivo para los archivos subidos (X-12, T056).

Un nombre predecible o elegido por quien sube el archivo permite adivinar rutas, pisar archivos y
colar caracteres raros en el sistema de archivos. Se guarda con un uuid4 aleatorio y la extensión
original en minúsculas, dentro de la carpeta del tipo y un subdirectorio por año y mes.
"""
import os
import uuid

from django.utils import timezone
from django.utils.deconstruct import deconstructible


@deconstructible
class RutaUnica:
    """``upload_to`` invocable: ``<carpeta>/<año>/<mes>/<uuid4>.<ext>``. Serializable en migraciones."""

    def __init__(self, carpeta: str):
        self.carpeta = carpeta

    def __call__(self, instance, filename: str) -> str:
        extension = os.path.splitext(filename)[1].lower()
        return f'{self.carpeta}/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{extension}'

    def __eq__(self, other):
        return isinstance(other, RutaUnica) and other.carpeta == self.carpeta
