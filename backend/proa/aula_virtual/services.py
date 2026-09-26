from rest_framework.exceptions import ValidationError
from .models import Actividad, Entrega, Nota
from .helpers import verificar_profesor_materia, obtener_persona_y_rol, validar_rango_nota, calcular_promedio, verificar_estudiante_materia


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


def obtener_rendimiento_estudiante(user, materia) -> dict:
    persona, rol = obtener_persona_y_rol(user)

    verificar_estudiante_materia(user, materia)

    # Actividades publicadas y activas
    actividades = Actividad.objects.filter(
        materia=materia,
        fecha_baja__isnull=True
    ).exclude(estado=Actividad.EstadoActividad.BORRADOR).order_by('fecha_creacion')

    # Notas activas del estudiante
    notas_qs = Nota.objects.filter(
        entrega__actividad__materia=materia,
        entrega__actividad__fecha_baja__isnull=True,
        entrega__estudiante=persona, 
        entrega__fecha_baja__isnull=True
    ).select_related('entrega__actividad')

    mapa_notas = {n.entrega.actividad_id: n for n in notas_qs}

    actividades_detalle = []
    calificaciones_validas = []

    for act in actividades:
        nota_obj = mapa_notas.get(act.id)
        if nota_obj:
            calificaciones_validas.append(nota_obj.calificacion)
            calif_str = str(nota_obj.calificacion)
            devolucion = nota_obj.descripcion or ''
        else:
            calif_str = None
            devolucion = None

        actividades_detalle.append({
            'actividad_id': act.id,
            'titulo': act.titulo,
            'calificacion': calif_str,
            'devolucion': devolucion
        })

    promedio_final = calcular_promedio(calificaciones_validas)

    return {
        'materia_id': materia.id,
        'materia_titulo': materia.titulo,
        'anio': materia.anio,
        'curso': materia.curso,
        'estudiante': {
            'id': persona.id,
            'nombre_completo': f"{persona.apellido}, {persona.nombre}".strip(),
            'dni': getattr(persona, 'dni', None),
        },
        'total_evaluaciones': len(calificaciones_validas),
        'promedio': promedio_final,
        'actividades': actividades_detalle
    }


# Para obtener la nomina de estudiantes, actividades y notas con promedios
def obtener_rendimiento_curso_profesor(user, materia) -> dict:
    persona, rol = obtener_persona_y_rol(user)
    verificar_profesor_materia(user, materia)

    estudiantes = materia.estudiantes.filter(fecha_baja__isnull=True).order_by('apellido', 'nombre')
    actividades = Actividad.objects.filter(
        materia=materia,
        fecha_baja__isnull=True
    ).exclude(estado=Actividad.EstadoActividad.BORRADOR).order_by('fecha_creacion')

    # Consultar todas las notas activas en una sola query
    notas_qs = Nota.objects.filter(
        entrega__actividad__materia=materia,
        entrega__actividad__fecha_baja__isnull=True,
        entrega__fecha_baja__isnull=True
    ).select_related('entrega__actividad', 'entrega__estudiante')

    mapa_notas = {(n.entrega.estudiante_id, n.entrega.actividad_id): n for n in notas_qs}

    alumnos_resumen = []

    for est in estudiantes:
        mis_calificaciones = []
        notas_alumno_detalle = []

        for act in actividades:
            nota_obj = mapa_notas.get((est.id, act.id))
            if nota_obj:
                mis_calificaciones.append(nota_obj.calificacion)
                calif_str = str(nota_obj.calificacion)
            else:
                calif_str = None

            notas_alumno_detalle.append({
                'actividad_id': act.id,
                'titulo': act.titulo,
                'calificacion': calif_str
            })

        prom_alumno = calcular_promedio(mis_calificaciones)

        alumnos_resumen.append({
            'estudiante_id': est.id,
            'nombre_completo': f"{est.apellido}, {est.nombre}".strip(),
            'dni': getattr(est, 'dni', None),
            'total_evaluaciones': len(mis_calificaciones),
            'promedio': prom_alumno,
            'calificaciones': notas_alumno_detalle
        })

    return {
        'materia_id': materia.id,
        'materia_titulo': materia.titulo,
        'anio': materia.anio,
        'curso': materia.curso,
        'total_alumnos': estudiantes.count(),
        'actividades': [{'id': a.id, 'titulo': a.titulo} for a in actividades],
        'alumnos': alumnos_resumen
    }


