from django.db import models
from django.utils import timezone


class ContenidoSoftDelete(models.Model):
    """Baja lógica: el registro queda con ``fecha_baja`` y se conserva todo lo que depende de él."""

    fecha_baja = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def soft_delete(self):
        self.fecha_baja = timezone.now()
        self.save(update_fields=['fecha_baja'])

    def restore(self):
        self.fecha_baja = None
        self.save(update_fields=['fecha_baja'])
