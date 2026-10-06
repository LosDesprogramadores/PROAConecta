from django.db.models import Q

from .models import Inscripcion, Materia


def alumnos_de_materia(materia, estado=None, search=None):
    # Sin filtro de estado cuentan todos los inscriptos menos la baja administrativa
    # (CURSANDO, REGULAR, PROMOCIONADO y LIBRE siguen siendo alumnos de la materia)
    # Pendiente de decisión de producto con el equipo: si LIBRE debe contarse como alumno activo (ver backend.md, A3)
    inscripciones = Inscripcion.objects.filter(materia=materia).select_related('estudiante')

    if estado:
        inscripciones = inscripciones.filter(estado=estado)
    else:
        inscripciones = inscripciones.exclude(estado=Inscripcion.EstadoInscripcion.BAJA)

    if search:
        inscripciones = inscripciones.filter(
            Q(estudiante__apellido__icontains=search) | Q(estudiante__nombre__icontains=search)
        )

    return inscripciones.order_by('estudiante__apellido', 'estudiante__nombre', 'id')


def materias_con_acceso(persona):
    # Materias a las que un estudiante tiene acceso: toda inscripción menos BAJA (LIBRE incluida)
    inscripciones = Inscripcion.objects.filter(estudiante=persona).exclude(estado=Inscripcion.EstadoInscripcion.BAJA)
    return Materia.objects.filter(id__in=inscripciones.values('materia_id'))
