from django.db import models 
from usuario.models import Persona, Rol

class Materia(models.Model):
    titulo = models.CharField(max_length=150)
    descripcion = models.TextField(max_length=500, null=True, blank=True)
    criterios_evaluacion = models.TextField(max_length=500,null=True, blank=True)
    anio = models.PositiveSmallIntegerField(help_text='Año de la materia (por ejemplo, 2026)')
    curso = models.CharField(max_length=20, help_text='Curso de la materia (por ejemplo, 1ro A, 2do C, 3ro A, etc.)')

    docente = models.ForeignKey(
        'usuario.Persona',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='materias'
    )


    class Meta:
        db_table = 'materia'
        verbose_name = 'Materia'
        verbose_name_plural = 'Materias'
        ordering = ['anio', 'curso', 'titulo']

    def __str__(self):
        return f'{self.titulo} - {self.curso} - {self.anio}'
    

# # class Inscripcion(models.Model):
# #     materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name='inscripciones')
# #     estudiante = models.ForeignKey('usuario.Estudiante', on_delete=models.CASCADE, related_name='inscripciones')
# #     fecha_inscripcion = models.DateField(auto_now_add=True)
# #     estado = models.CharField(max_length=50, default='Activa')

# #     class Meta:
# #         db_table = 'inscripcion'
# #         constraints = [
# #             models.UniqueConstraint(fields=['materia', 'estudiante'], name='unique_materia_estudiante')
# #         ]

# #     def __str__(self):
# #         return f'{self.estudiante} - {self.materia}'


# # class Material(models.Model):
# #     materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name='materiales')
# #     titulo = models.CharField(max_length=150) 
# #     descripcion = models.TextField(null=True, blank=True)
# #     url_archivo = models.CharField(max_length=500)
# #     formato = models.CharField(max_length=50)
# #     visible = models.BooleanField(default=True)
# #     fecha_publicacion = models.DateTimeField(auto_now_add=True)

# #     class Meta:
# #         db_table = 'material'
    
# #     def __str__(self):
# #         return self.titulo
  

# # class Actividad(models.Model):
# #     materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name='actividades')
# #     titulo = models.CharField(max_length=150)
# #     descripcion = models.TextField(null=True, blank=True)
# #     fecha_limite = models.DateTimeField()
# #     estado = models.CharField(max_length=50, default='Borrador')
# #     fecha_creacion = models.DateTimeField(auto_now_add=True)

# #     class Meta:
# #         db_table = 'actividad'
# #         verbose_name = 'Actividad'
# #         verbose_name_plural = 'Actividades'
    
# #     def __str__(self):
# #         return self.titulo


# # class Entrega(models.Model):
# #     actividad = models.ForeignKey(Actividad, on_delete=models.CASCADE, related_name='entregas')
# #     estudiante = models.ForeignKey('usuario.Estudiante', on_delete=models.CASCADE, related_name='entregas')
# #     url_archivo = models.CharField(max_length=500, null=True, blank=True)
# #     contenido_texto = models.TextField(null=True, blank=True)
# #     fecha_entrega = models.DateTimeField(auto_now_add=True)

# #     class Meta:
# #         db_table = 'entrega'

# #     def __str__(self):
# #         return f'{self.estudiante} - {self.actividad}'


# # class Estado(models.Model):
# #     codigo = models.CharField(max_length=50, unique=True)
# #     nombre = models.CharField(max_length=100)
# #     descripcion = models.CharField(max_length=255, null=True, blank=True) 

# #     class Meta:
# #         db_table = 'estado'
    
# #     def __str__(self):
# #         return self.nombre


# # class CambioEstado(models.Model):
# #     entrega = models.ForeignKey(Entrega, on_delete=models.CASCADE, related_name='cambios_estado')
# #     estado = models.ForeignKey(Estado, on_delete=models.PROTECT, related_name='cambios_estado')
# #     fecha_inicio = models.DateTimeField(auto_now_add=True)
# #     fecha_fin = models.DateTimeField(null=True, blank=True)

# #     class Meta:
# #         db_table = 'cambio_estado'
    
# #     def __str__(self):
# #         return f'{self.entrega} - {self.estado}'


# # class Nota(models.Model):
# #     entrega = models.OneToOneField(Entrega, on_delete=models.CASCADE, related_name='nota')
# #     calificacion = models.DecimalField(max_digits=5, decimal_places=2)
# #     descripcion = models.TextField(null=True, blank=True)
# #     fecha_publicacion = models.DateTimeField(auto_now_add=True)

# #     class Meta:
# #         db_table = 'nota'

# #     def __str__(self):
# #         return f'{self.calificacion} - {self.entrega}'
