# aula_virtual/services.py
from rest_framework.exceptions import ValidationError
from .models import Actividad, Entrega, Nota
from .helpers import verificar_profesor_materia, obtener_persona_y_rol, validar_rango_nota

def calificar_o_rectificar_estudiante(profesor_user, actividad_id: int, estudiante_id: int, calificacion, descripcion: str = ''):
    actividad = Actividad.objects.filter(pk=actividad_id, fecha_baja__isnull=True).select_related('materia').first()
    if not actividad:
        raise ValidationError({'actividad_id': 'Actividad no encontrada o dada de baja.'})

    verificar_profesor_materia(profesor_user, actividad.materia)
    profesor, _ = obtener_persona_y_rol(profesor_user)

    if not actividad.materia.estudiantes.filter(id=estudiante_id).exists():
        raise ValidationError({'estudiante_id': 'El estudiante no está matriculado en esta materia.'})

    nota_val = validar_rango_nota(calificacion)

    # Buscar entrega activa existente
    entrega = Entrega.objects.filter(
        actividad=actividad,
        estudiante_id=estudiante_id,
        fecha_baja__isnull=True
    ).first()

    # Si no entregó nada, se genera la entrega administrativa
    if not entrega:
        entrega = Entrega.objects.create(
            actividad=actividad,
            estudiante_id=estudiante_id,
            fuera_de_termino=True,
            estado=Entrega.EstadoEntrega.CORREGIDO
        )

    # Asentar o actualizar la nota 
    nota, _ = Nota.objects.update_or_create(
        entrega=entrega,
        defaults={
            'calificacion': nota_val,
            'descripcion': descripcion.strip(),
            'profesor': profesor
        }
    )

    if entrega.estado != Entrega.EstadoEntrega.CORREGIDO:
        entrega.estado = Entrega.EstadoEntrega.CORREGIDO
        entrega.save(update_fields=['estado'])

    return nota