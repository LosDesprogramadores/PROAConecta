from django.core.management.base import BaseCommand
from pymongo import ASCENDING, DESCENDING

from notificacion.mongo import COLECCION_NOTIFICACION, obtener_coleccion

# Colección -> índices (lista de claves). Las colecciones mensaje y bitacora
# suman los suyos cuando se creen sus apps.
INDICES = {
    COLECCION_NOTIFICACION: [
        # Lo usa hoy el listado: find().sort('fecha_creacion', -1) sin filtro
        [('fecha_creacion', DESCENDING)],
        # Los tres siguientes sirven al listado filtrado previsto en 007/T017
        # (contracts/notificaciones-anuncios.md); todavía no hay consultas que los usen
        [('materia_id', ASCENDING), ('fecha_creacion', DESCENDING)],
        [('alcance', ASCENDING), ('fecha_creacion', DESCENDING)],
        [('usuario_destino_id', ASCENDING), ('fecha_creacion', DESCENDING)],
    ],
}


class Command(BaseCommand):
    help = 'Crea los índices de las colecciones de MongoDB. Es seguro ejecutarlo más de una vez.'

    def handle(self, *args, **options):
        for nombre, indices in INDICES.items():
            coleccion = obtener_coleccion(nombre)
            for claves in indices:
                creado = coleccion.create_index(claves)
                self.stdout.write(f'{nombre}: índice {creado}')
        self.stdout.write(self.style.SUCCESS('Índices de MongoDB listos.'))
