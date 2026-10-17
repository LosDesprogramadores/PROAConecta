from django.db import IntegrityError, transaction

from auditoria.bitacora import registrar_evento

from .models import Inscripcion


def inscribir(actor, pares):
    """Inscribe cada par (estudiante_id, materia_id) de forma atómica.

    Crea las inscripciones que no existen y reactiva las que están en BAJA; las demás (LIBRE incluida)
    se omiten. Devuelve (inscripciones creadas o reactivadas, pares omitidos) respetando el orden de entrada.
    """
    Estado = Inscripcion.EstadoInscripcion
    estudiante_ids = {estudiante_id for estudiante_id, _ in pares}
    materia_ids = {materia_id for _, materia_id in pares}

    def leer_existentes():
        # select_for_update serializa lotes concurrentes sobre los mismos pares (no-op en SQLite)
        filas = Inscripcion.objects.select_for_update().filter(
            estudiante_id__in=estudiante_ids, materia_id__in=materia_ids,
        )
        return {(i.estudiante_id, i.materia_id): i for i in filas}

    def clasificar(existentes):
        nuevas, reactivadas, omitidos = [], [], []
        for estudiante_id, materia_id in pares:
            inscripcion = existentes.get((estudiante_id, materia_id))
            if inscripcion is None:
                nuevas.append(Inscripcion(estudiante_id=estudiante_id, materia_id=materia_id, estado=Estado.CURSANDO))
            elif inscripcion.estado == Estado.BAJA:
                # Se reactiva la misma fila: no se duplica la inscripción
                inscripcion.estado = Estado.CURSANDO
                reactivadas.append(inscripcion)
            else:
                omitidos.append((estudiante_id, materia_id))
        return nuevas, reactivadas, omitidos

    with transaction.atomic():
        nuevas, reactivadas, omitidos = clasificar(leer_existentes())
        try:
            # Savepoint: un conflicto de unicidad no envenena la transacción exterior
            with transaction.atomic():
                Inscripcion.objects.bulk_create(nuevas)
        except IntegrityError:
            # Otro lote inscribió alguno de los pares entre la lectura y la escritura: se relee y
            # esos pares pasan a ser existentes (omitidos, o reactivados si quedaron en BAJA)
            nuevas, reactivadas, omitidos = clasificar(leer_existentes())
            Inscripcion.objects.bulk_create(nuevas)
        Inscripcion.objects.bulk_update(reactivadas, ['estado'])

        nuevas_por_par = {(i.estudiante_id, i.materia_id): i for i in nuevas}
        reactivadas_por_par = {(i.estudiante_id, i.materia_id): i for i in reactivadas}
        creadas = []
        for par in pares:
            inscripcion = nuevas_por_par.get(par) or reactivadas_por_par.get(par)
            if inscripcion is None:
                continue
            creadas.append(inscripcion)
            datos = {'despues': {'estado': inscripcion.estado, 'estudiante_id': inscripcion.estudiante_id}}
            if par in reactivadas_por_par:
                datos['antes'] = {'estado': Estado.BAJA}
            registrar_evento(
                'INSCRIPCION_CREADA', actor, 'inscripcion', datos,
                entidad_id=inscripcion.pk, materia_id=inscripcion.materia_id,
            )

    return creadas, omitidos
