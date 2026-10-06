"""Descarga autorizada de archivos subidos (X-12, T057): ``GET /api/archivos/<tipo>/<id>/``.

Los archivos ya no se sirven desde ``/media/``. Esta vista es la única puerta: verifica el rol y el
vínculo con la materia, y responde con ``Content-Disposition: attachment``. Quien no tiene acceso
recibe 404 (igual que un id inexistente) para no revelar qué archivos existen.

Reglas (las mismas que los listados de ``views.py``):
- Material y adjunto de actividad: administrador; profesor titular de la materia; estudiante con
  inscripción activa (no BAJA) cuando el contenido está visible (material con ``visible`` y unidad
  visible y activa; actividad publicada) y no fue dado de baja.
- Entrega: administrador; profesor titular; el estudiante dueño mientras siga con inscripción activa.
- Una materia dada de baja solo se ve como administrador.
"""
import os
from typing import NamedTuple

from django.http import FileResponse, Http404
from django.utils.text import slugify
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.roles import es_admin, es_estudiante, es_profesor_de_materia, obtener_persona_y_rol, tiene_inscripcion_activa

from .models import Actividad, Entrega, Material

TIPO_MATERIAL = 'material'
TIPO_ACTIVIDAD = 'actividad'
TIPO_ENTREGA = 'entrega'


class Descargable(NamedTuple):
    materia: object
    archivo: object
    titulo: str
    visible_para_estudiante: bool
    estudiante_dueno_id: int | None = None


def _unidad_visible(unidad) -> bool:
    return unidad is None or (unidad.visible and unidad.fecha_baja is None)


def _material(pk):
    material = Material.objects.select_related('materia', 'unidad').filter(pk=pk).first()
    if material is None:
        return None
    visible = material.fecha_baja is None and material.visible and _unidad_visible(material.unidad)
    return Descargable(material.materia, material.archivo, material.titulo, visible)


def _actividad(pk):
    actividad = Actividad.objects.select_related('materia', 'unidad').filter(pk=pk).first()
    if actividad is None:
        return None
    visible = (
        actividad.fecha_baja is None
        and actividad.estado == Actividad.EstadoActividad.PUBLICADA
        and _unidad_visible(actividad.unidad)
    )
    return Descargable(actividad.materia, actividad.archivo_adjunto, actividad.titulo, visible)


def _entrega(pk):
    entrega = Entrega.objects.select_related('actividad__materia').filter(pk=pk).first()
    if entrega is None:
        return None
    return Descargable(
        entrega.actividad.materia, entrega.archivo, f'entrega-{entrega.pk}',
        entrega.fecha_baja is None, entrega.estudiante_id,
    )


BUSCADORES = {TIPO_MATERIAL: _material, TIPO_ACTIVIDAD: _actividad, TIPO_ENTREGA: _entrega}


def _autorizado(user, descargable: Descargable) -> bool:
    materia = descargable.materia
    if es_admin(user):
        return True
    if materia.fecha_baja is not None:
        return False
    if es_profesor_de_materia(user, materia):
        return True
    persona, _ = obtener_persona_y_rol(user)
    if not es_estudiante(user) or persona is None or not descargable.visible_para_estudiante:
        return False
    dueno = descargable.estudiante_dueno_id
    if dueno is not None and dueno != persona.id:
        return False  # entrega ajena, aunque sea de la misma materia
    return tiene_inscripcion_activa(persona, materia)


def nombre_descarga(titulo: str, ruta_archivo: str) -> str:
    """Título saneado más la extensión real; nunca el nombre interno (uuid) ni texto libre sin limpiar."""
    base = slugify(titulo)[:80] or 'archivo'
    return f'{base}{os.path.splitext(ruta_archivo)[1].lower()}'


class DescargaArchivoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, tipo, pk):
        buscador = BUSCADORES.get(tipo)
        encontrado = buscador(pk) if buscador else None
        if encontrado is None:
            raise Http404
        if not encontrado.archivo or not _autorizado(request.user, encontrado):
            raise Http404

        try:
            apertura = encontrado.archivo.open('rb')
        except (FileNotFoundError, ValueError):
            raise Http404

        nombre = nombre_descarga(encontrado.titulo, encontrado.archivo.name)
        # Siempre octet-stream: el tipo lo elige quien sube el archivo y no se confía en él; con attachment
        # y nosniff (SecurityMiddleware) el navegador descarga y nunca interpreta el contenido
        return FileResponse(apertura, as_attachment=True, filename=nombre, content_type='application/octet-stream')
