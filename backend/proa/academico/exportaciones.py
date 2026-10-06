"""Archivos de notas: el curso del profesor (CSV o PDF) y el boletín del estudiante (PDF).

Parten de los diccionarios que ya arman los servicios de ``aula_virtual`` para que el archivo y la
pantalla muestren exactamente los mismos números (mismo promedio, mismo redondeo).
"""
from core.exportaciones import exportar_tabla, nombre_archivo, secciones_a_pdf, tabla_a_pdf

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


def exportar_boletin(persona, rendimientos):
    """Boletín del estudiante: una sección por materia (actividad, nota, estado y fila de promedio) y un resumen.

    ``rendimientos`` es la lista de ``obtener_rendimiento_estudiante`` de cada materia vigente.
    """
    secciones = []
    resumen = []
    for datos in rendimientos:
        titulo = f"{datos['materia_titulo']} ({datos['curso']}, {datos['anio']})"
        if datos['total_evaluaciones'] == 0:
            filas = [['Sin calificaciones', '', '']]
        else:
            filas = [
                [a['titulo'], a['calificacion'] or SIN_NOTA_PDF, 'Calificada' if a['calificacion'] else 'Sin calificar']
                for a in datos['actividades']
            ]
            filas.append(['Promedio', datos['promedio'] or '', ''])
        secciones.append({'titulo': titulo, 'columnas': ['Actividad', 'Nota', 'Estado'], 'filas': filas})
        resumen.append([datos['materia_titulo'], datos['promedio'] or ''])

    secciones.append({'titulo': 'Resumen', 'columnas': ['Materia', 'Promedio'], 'filas': resumen})
    return secciones_a_pdf(
        'Boletín de calificaciones',
        secciones,
        nombre=nombre_archivo(f'boletin-{persona.apellido}', 'pdf'),
        subtitulo=f'Estudiante: {persona.apellido}, {persona.nombre} - PROA Conecta',
    )
