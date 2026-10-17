import logging

from django.core.management.base import BaseCommand

from notificacion import services

logger = logging.getLogger(__name__)


def pendientes():
    return services.pendientes_de_publicar()


class Command(BaseCommand):
    help = (
        'Publica en tiempo real los avisos programados cuya fecha de inicio ya llegó. '
        'Es idempotente: cada aviso se reclama de forma atómica y se publica una sola vez.'
    )

    def handle(self, *args, **options):
        descartados = services.descartar_vencidos()
        if descartados:
            self.stdout.write(f'Avisos programados vencidos sin publicar: {descartados}.')
        publicados = 0
        for obj_id in pendientes():
            doc = services.reclamar(obj_id)
            if doc is None:
                continue  # otra ejecución lo reclamó o se eliminó
            try:
                services.publicar_aviso(obj_id, doc)
            except Exception:
                # Redis o el canal no responden: se devuelve la marca para reintentar en la próxima vuelta
                services.devolver_marca(obj_id)
                logger.warning('No se pudo publicar el aviso programado %s; se reintentará', obj_id, exc_info=True)
                continue
            publicados += 1
        if publicados:
            self.stdout.write(f'Avisos programados publicados: {publicados}.')
        else:
            self.stdout.write('Sin avisos programados para publicar.')
