from django.db import models
from usuario.models import Persona
from academico.models import Materia
from django.utils import timezone


class Unidad(models.Model):
    materia = models.ForeignKey(Materia,on_delete=models.CASCADE,related_name='unidades')
    numero = models.PositiveIntegerField(help_text="Ej: 1 para Unidad 1")
    titulo = models.CharField(max_length=150, help_text="Ej: Matemáticas")
    descripcion = models.TextField(null=True,blank=True)
    orden = models.PositiveIntegerField(default=1)
    fecha_baja = models.DateTimeField(null=True, blank=True)

    class Meta: 
        db_table = 'unidad'
        verbose_name = 'Unidad'
        verbose_name_plural = 'Unidades'
        ordering = ['orden', 'numero']
        constraints = [
            models.UniqueConstraint(
                fields=['materia', 'numero'],
                condition=models.Q(fecha_baja__isnull=True),
                name='unique_unidad_activa_materia'
            )
        ]

    def soft_delete(self):
        self.fecha_baja = timezone.now()
        self.save(update_fields=['fecha_baja'])

    def restore(self):
        self.fecha_baja = None
        self.save(update_fields=['fecha_baja'])

    def __str__(self):
        return f'Unidad {self.numero}: {self.titulo} ({self.materia.titulo})'


class Material(models.Model):
    class TipoContenido(models.TextChoices):
        DOCUMENTO = 'DOCUMENTO', 'Documento'
        VIDEO = 'VIDEO', 'Video'
        ENLACE = 'ENLACE', 'Enlace externo'
        
    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name='materiales')
    unidad = models.ForeignKey(Unidad,on_delete=models.CASCADE,null=True,blank=True,related_name='materiales',help_text='Si es NULL es un recurso de la clase. Si tiene ID pertenece a una unidad')
    tipo = models.CharField(max_length=20,choices=TipoContenido.choices, default=TipoContenido.DOCUMENTO)

    titulo = models.CharField(max_length=150) 
    descripcion = models.TextField(null=True, blank=True)
    archivo = models.FileField(upload_to='materiales/%Y/%m/', null=True, blank=True)
    enlace = models.URLField(max_length=500, blank=True, null=True)
    visible = models.BooleanField(default=True)
    fecha_publicacion = models.DateTimeField(auto_now_add=True)
    fecha_baja = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'material'
        verbose_name = 'Material'
        verbose_name_plural = 'Materiales'
        ordering = ['-fecha_publicacion']

    def soft_delete(self):
        self.fecha_baja = timezone.now()
        self.save(update_fields=['fecha_baja'])

    def restore(self):
        self.fecha_baja = None
        self.save(update_fields=['fecha_baja'])
    
    def __str__(self):
        return f'{self.titulo} - {self.materia.titulo}'
  

class Actividad(models.Model):
    class EstadoActividad(models.TextChoices):
        BORRADOR = 'BORRADOR', "Borrador"
        PUBLICADA = 'PUBLICADA', "Publicada"

    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name='actividades')

    titulo = models.CharField(max_length=150)
    descripcion = models.TextField(null=True, blank=True)
    enlace = models.URLField(max_length=500, null=True, blank=True, help_text="Link a Google Drive o web con consigna/material complementario")
    archivo_adjunto = models.FileField(upload_to='actividades/%Y/%m/', null=True,blank=True)
    fecha_limite = models.DateTimeField()
    permitir_entrega_tardia = models.BooleanField(default=True)
    estado = models.CharField(max_length=50, choices=EstadoActividad.choices, default= EstadoActividad.PUBLICADA)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'actividad'
        verbose_name = 'Actividad'
        verbose_name_plural = 'Actividades'
        ordering = ['-fecha_creacion']
    
    def __str__(self):
        return f'{self.titulo} ({self.materia.titulo})'


class Entrega(models.Model):
    class EstadoEntrega(models.TextChoices):
        BORRADOR = 'BORRADOR', 'Borrador'
        ENTREGADO = 'ENTREGADO', 'Entregado'
        CORREGIDO = 'CORREGIDO', 'Corregido'
        REENTREGA = 'REENTREGA', 'Reentrega'

    actividad = models.ForeignKey(Actividad, on_delete=models.CASCADE, related_name='entregas')
    estudiante = models.ForeignKey(Persona, on_delete=models.CASCADE, related_name='entregas')
    archivo = models.FileField(upload_to='entregas/%Y/%m/', null=True, blank=True)
    enlace = models.URLField(max_length=500, null=True, blank=True)
    contenido_texto = models.TextField(null=True, blank=True)
    fuera_de_termino = models.BooleanField(default=False)
    estado = models.CharField(
        max_length=20,
        choices=EstadoEntrega.choices,
        default=EstadoEntrega.ENTREGADO
    )
    fecha_entrega = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'entrega'
        verbose_name = 'Entrega'
        verbose_name_plural = 'Entregas'
        ordering = ['-fecha_entrega']
        constraints = [models.UniqueConstraint(
            fields=['actividad', 'estudiante'],
            name='unique_entrega_actividad_estudiante'
        )]

    def __str__(self):
        return f'Entrega: {self.estudiante.id} - {self.actividad.titulo}'



class Nota(models.Model):
    actividad = models.ForeignKey(Actividad, on_delete=models.CASCADE, related_name='notas')
    estudiante = models.ForeignKey(Persona, on_delete=models.CASCADE, related_name='notas')
    entrega = models.OneToOneField(Entrega, on_delete=models.SET_NULL, null=True,blank=True, related_name='nota')
    profesor = models.ForeignKey(Persona, on_delete=models.SET_NULL, null=True, blank=True, related_name='notas_asentadas')
    calificacion = models.DecimalField(max_digits=4, decimal_places=2, help_text='1 a 10')
    descripcion = models.TextField(null=True,blank=True, help_text='Devolución o feedback del docente')
    fecha_publicacion = models.DateTimeField(auto_now_add=True)


    class Meta:
        db_table = 'nota'
        verbose_name = 'Nota'
        verbose_name_plural = 'Notas'
        constraints = [models.UniqueConstraint(
            fields=['actividad', 'estudiante'],
            name='unique_nota_actividad_estudiante'
        )]

    def __str__(self):
        return f'{self.calificacion} | {self.estudiante.id} - {self.actividad.titulo}'
