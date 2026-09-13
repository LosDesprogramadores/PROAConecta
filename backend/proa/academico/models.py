from django.db import models
from usuario.models import Persona


class Materia(models.Model):
    titulo = models.CharField(max_length=150)
    descripcion = models.TextField(null=True, blank=True)
    criterios_evaluacion = models.TextField(null=True, blank=True)
    anio = models.PositiveSmallIntegerField(help_text='Año de la materia (por ejemplo, 2026)')
    curso = models.CharField(max_length=20, help_text='Curso de la materia (por ejemplo, 1ro A, 2do C, 3ro A, etc.)')

    # profesor titular
    profesor = models.ForeignKey(
        Persona,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='materias_a_cargo'
    )

    # Lista de estudiantes
    estudiantes = models.ManyToManyField(
        Persona,
        through='Inscripcion',
        related_name='materias_inscriptas',
        blank=True
    )

    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'materia'
        verbose_name = 'Materia'
        verbose_name_plural = 'Materias'
        ordering = ['-anio', 'curso', 'titulo']
        constraints = [
            models.UniqueConstraint(
                fields=['titulo', 'curso', 'anio'],
                name='unique_materia_curso_anio'
            )
        ]

    def __str__(self):
        return f'{self.titulo} - {self.curso} - {self.anio}'


class Inscripcion(models.Model):
    class EstadoInscripcion(models.TextChoices):
        CURSANDO = 'CURSANDO', 'Cursando'
        REGULAR = 'REGULAR', 'Regular'
        PROMOCIONADO = 'PROMOCIONADO', 'Promocionado'
        LIBRE = 'LIBRE', 'Libre'
        BAJA = 'BAJA', 'Baja Administrativa'

    materia = models.ForeignKey(
        Materia,
        on_delete=models.CASCADE,
        related_name='inscripciones'
    )
    estudiante = models.ForeignKey(
        Persona,
        on_delete=models.CASCADE,
        related_name='inscripciones'
    )
    fecha_inscripcion = models.DateField(auto_now_add=True)
    estado = models.CharField(
        max_length=20,
        choices=EstadoInscripcion.choices,
        default=EstadoInscripcion.CURSANDO
    )

    class Meta:
        db_table = 'inscripcion'
        verbose_name = 'Inscripción'
        verbose_name_plural = 'Inscripciones'
        constraints = [
            models.UniqueConstraint(
                fields=['materia', 'estudiante'],
                name='unique_materia_estudiante'
            )
        ]

    def __str__(self):
        return f'{self.estudiante} - {self.materia} [{self.estado}]'

