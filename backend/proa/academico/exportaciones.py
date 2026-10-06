"""Archivos de notas: el curso del profesor (CSV o PDF) y el boletín del estudiante (PDF).

Parten de los diccionarios que ya arman los servicios de ``aula_virtual`` para que el archivo y la
pantalla muestren exactamente los mismos números (mismo promedio, mismo redondeo).
"""
from core.exportaciones import exportar_tabla, nombre_archivo, tabla_a_pdf

SIN_NOTA_PDF = '-'


def exportar_rendimiento_curso(formato, materia, datos):
    """Estudiantes x actividades con el promedio. CSV sin DNI; PDF A4 horizontal con el docente titular."""
    titulos = [actividad['titulo'] for actividad in datos['actividades']]
    recurso = f'calificaciones-{materia.titulo}'

    if formato == 'pdf':
        columnas = ['Estudiante', *titulos, 'Promedio']
        filas = [
            [
                alumno['nombre_completo'],
                *[c['calificacion'] or SIN_NOTA_PDF for c in alumno['calificaciones']],
                alumno['promedio'] or SIN_NOTA_PDF,
            ]
            for alumno in datos['alumnos']
        ]
        profesor = materia.profesor
        docente = f'{profesor.apellido}, {profesor.nombre}' if profesor else 'Sin asignar'
        return tabla_a_pdf(
            f'Calificaciones - {materia.titulo} ({materia.curso}, {materia.anio})',
            columnas,
            filas,
            horizontal=True,
            nombre=nombre_archivo(recurso, 'pdf'),
            subtitulo=f'Docente titular: {docente}',
        )

    columnas = ['apellido', 'nombre', *titulos, 'promedio']
    filas = (
        [
            alumno['apellido'],
            alumno['nombre'],
            *[c['calificacion'] or '' for c in alumno['calificaciones']],
            alumno['promedio'] or '',
        ]
        for alumno in datos['alumnos']
    )
    return exportar_tabla('csv', recurso, '', columnas, filas)
