from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from auditoria.bitacora import registrar_evento
from academico.selectors import alumnos_de_materia
from usuario.models import Persona
from .models import Actividad, Entrega, Nota
from .helpers import verificar_profesor_materia, obtener_persona_y_rol, validar_rango_nota, calcular_promedio, verificar_estudiante_materia


def calificar_o_rectificar_estudiante(profesor_user, actividad_id: int, estudiante_id: int, calificacion, descripcion: str = ''):
    actividad = Actividad.objects.filter(
        pk=actividad_id, fecha_baja__isnull=True, materia__fecha_baja__isnull=True
    ).select_related('materia').first()
    if not actividad:
        raise ValidationError({'actividad_id': 'Actividad no encontrada o dada de baja.'})

    verificar_profesor_materia(profesor_user, actividad.materia)
    profesor, _ = obtener_persona_y_rol(profesor_user)

    if not alumnos_de_materia(actividad.materia).filter(estudiante_id=estudiante_id).exists():
        raise ValidationError({'estudiante_id': 'El estudiante no está matriculado en esta materia.'})

    nota_val = validar_rango_nota(calificacion)

    with transaction.atomic():
        # Entrega activa existente, bloqueada hasta el final de la transacción
        entrega = Entrega.objects.select_for_update().filter(
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

        return _asentar_nota(profesor_user, profesor, entrega, nota_val, descripcion)


def calificar_entrega(profesor_user, entrega, calificacion, descripcion: str = ''):
    """Asienta o modifica la calificación de una entrega existente, con la misma regla y bitácora."""
    verificar_profesor_materia(profesor_user, entrega.actividad.materia)
    profesor, _ = obtener_persona_y_rol(profesor_user)
    nota_val = validar_rango_nota(calificacion)

    with transaction.atomic():
        entrega = Entrega.objects.select_for_update().select_related('actividad').get(pk=entrega.pk)
        return _asentar_nota(profesor_user, profesor, entrega, nota_val, descripcion)


def _asentar_nota(profesor_user, profesor, entrega, nota_val, descripcion: str):
    """Crea o actualiza la nota, marca la entrega como corregida y registra el evento. Va dentro de una transacción."""
    calificacion_previa = Nota.objects.filter(entrega=entrega).values_list('calificacion', flat=True).first()
    nota, creada = Nota.objects.update_or_create(
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

    # Solo la calificación (ni la devolución escrita ni datos del estudiante)
    datos = {'despues': {'calificacion': f'{nota.calificacion:.2f}'}}
    if not creada:
        datos['antes'] = {'calificacion': f'{calificacion_previa:.2f}'}
    registrar_evento(
        'NOTA_CREADA' if creada else 'NOTA_MODIFICADA', profesor_user, 'nota', datos,
        entidad_id=nota.pk, materia_id=entrega.actividad.materia_id,
    )

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

    # Los alumnos en BAJA no cuentan; LIBRE sí
    estudiantes = Persona.objects.filter(
        id__in=alumnos_de_materia(materia).values('estudiante_id'), fecha_baja__isnull=True
    ).order_by('apellido', 'nombre')
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
            'apellido': est.apellido,
            'nombre': est.nombre,
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


ESTADOS_SEGUIMIENTO = ('PENDIENTE', 'ENTREGADO', 'FUERA_DE_TERMINO', 'CORREGIDO', 'NO_ENTREGADO')


def _estado_de_seguimiento(entrega, plazo_vencido: bool) -> str:
    # Una entrega en borrador o marcada sin entregar todavía no es una entrega del estudiante
    if entrega is None or entrega.estado in (Entrega.EstadoEntrega.BORRADOR, Entrega.EstadoEntrega.NO_ENTREGADO):
        return 'NO_ENTREGADO' if plazo_vencido else 'PENDIENTE'
    if entrega.estado == Entrega.EstadoEntrega.CORREGIDO or hasattr(entrega, 'nota'):
        return 'CORREGIDO'
    return 'FUERA_DE_TERMINO' if entrega.fuera_de_termino else 'ENTREGADO'


def seguimiento_de_actividad(usuario, actividad) -> dict:
    """Todos los inscriptos de la materia con el estado de su entrega en la actividad (BAJA no; LIBRE sí)."""
    materia = actividad.materia
    verificar_profesor_materia(usuario, materia)

    estudiantes = Persona.objects.filter(
        id__in=alumnos_de_materia(materia).values('estudiante_id'), fecha_baja__isnull=True
    ).order_by('apellido', 'nombre', 'id')
    entregas = {
        e.estudiante_id: e
        for e in Entrega.objects.filter(actividad=actividad, fecha_baja__isnull=True).select_related('nota')
    }
    plazo_vencido = bool(actividad.fecha_limite and timezone.now() > actividad.fecha_limite)

    filas = []
    resumen = dict.fromkeys(ESTADOS_SEGUIMIENTO, 0)
    for estudiante in estudiantes:
        entrega = entregas.get(estudiante.id)
        estado = _estado_de_seguimiento(entrega, plazo_vencido)
        resumen[estado] += 1
        nota = getattr(entrega, 'nota', None)
        filas.append({
            'estudiante_id': estudiante.id,
            'apellido': estudiante.apellido,
            'nombre': estudiante.nombre,
            'dni': estudiante.dni,
            'estado': estado,
            'entrega_id': entrega.id if entrega else None,
            'fecha_entrega': entrega.fecha_entrega if entrega else None,
            'nota': {'calificacion': nota.calificacion, 'descripcion': nota.descripcion} if nota else None,
        })

    return {
        'actividad': {'id': actividad.id, 'titulo': actividad.titulo, 'fecha_limite': actividad.fecha_limite},
        'materia': {'id': materia.id, 'titulo': materia.titulo},
        'resumen': resumen,
        'estudiantes': filas,
    }
