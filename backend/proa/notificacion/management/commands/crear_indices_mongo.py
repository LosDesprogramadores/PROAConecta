from django.core.management.base import BaseCommand
from pymongo import ASCENDING, DESCENDING

from notificacion.mongo import COLECCION_BITACORA, COLECCION_MENSAJE, COLECCION_NOTIFICACION, obtener_coleccion

# Colección -> índices: lista de claves, o (claves, opciones de create_index)
INDICES = {
    COLECCION_NOTIFICACION: [
        # Lo usa hoy el listado: find().sort('fecha_creacion', -1) sin filtro
        [('fecha_creacion', DESCENDING)],
        # Los tres siguientes sirven al listado filtrado previsto en 007/T017
        # (contracts/notificaciones-anuncios.md); todavía no hay consultas que los usen
        [('materia_id', ASCENDING), ('fecha_creacion', DESCENDING)],
        [('alcance', ASCENDING), ('fecha_creacion', DESCENDING)],
        [('usuario_destino_id', ASCENDING), ('fecha_creacion', DESCENDING)],
        # Barrido del programador de avisos: solo indexa los pendientes (pocos), no toda la colección
        ([('fecha_desde', ASCENDING)], {'partialFilterExpression': {'push_pendiente': True}}),
    ],
    COLECCION_MENSAJE: [
        # Bandeja de recibidos (por materia) y de enviados (mensajeria/repositorio.py)
        [('materia_id', ASCENDING), ('destinatario_id', ASCENDING), ('fecha_creacion', DESCENDING)],
        [('remitente_id', ASCENDING), ('fecha_creacion', DESCENDING)],
        [('destinatario_id', ASCENDING), ('fecha_creacion', DESCENDING)],
        # Contador de no leídos y listado de enviados: ambos filtran por fecha_baja
        [('destinatario_id', ASCENDING), ('leido', ASCENDING), ('fecha_baja', ASCENDING)],
        [('remitente_id', ASCENDING), ('fecha_baja', ASCENDING), ('fecha_creacion', DESCENDING)],
        # Conversación entre dos personas en una materia: cada rama del $or (A->B, B->A) usa este índice, y el
        # orden (fecha_creacion, _id) descendente de la consulta sale del índice sin ordenar en memoria
        [('materia_id', ASCENDING), ('remitente_id', ASCENDING), ('destinatario_id', ASCENDING),
         ('fecha_creacion', DESCENDING), ('_id', DESCENDING)],
    ],
    COLECCION_BITACORA: [
        # Listado general y por entidad / por actor (auditoria/bitacora.py)
        [('fecha', DESCENDING)],
        [('entidad', ASCENDING), ('entidad_id', ASCENDING), ('fecha', DESCENDING)],
        [('actor_id', ASCENDING), ('fecha', DESCENDING)],
        # Filtros por materia y por entidad_id solo (sin entidad)
        [('materia_id', ASCENDING), ('fecha', DESCENDING)],
        [('entidad_id', ASCENDING), ('fecha', DESCENDING)],
    ],
}


class Command(BaseCommand):
    help = 'Crea los índices de las colecciones de MongoDB. Es seguro ejecutarlo más de una vez.'

    def handle(self, *args, **options):
        for nombre, indices in INDICES.items():
            coleccion = obtener_coleccion(nombre)
            for indice in indices:
                claves, opciones = indice if isinstance(indice, tuple) else (indice, {})
                creado = coleccion.create_index(claves, **opciones)
                self.stdout.write(f'{nombre}: índice {creado}')
        self.stdout.write(self.style.SUCCESS('Índices de MongoDB listos.'))
