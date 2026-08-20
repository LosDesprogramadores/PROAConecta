from django.db import models
from django.contrib.auth.models import AbstractUser


class Persona(models.Model):
    rol = models.ForeignKey(
        'Rol',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)

    dni = models.CharField(
        max_length=11,
        unique=True
    )

    fecha_nacimiento = models.DateField()

    tel_contacto = models.CharField(
        max_length=30,
        blank=True
    )

    email = models.EmailField(
        unique=True
    )

    fecha_ingreso = models.DateField(
        auto_now_add=True
    )

    fecha_baja = models.DateField(
        null=True,
        blank=True
    )

    def __str__(self):
        return f"{self.apellido}, {self.nombre}"


class Usuario(AbstractUser):

    persona = models.OneToOneField(
        Persona,
        on_delete=models.CASCADE,
        related_name='usuario',
        null=True,
        blank=True
    )

    nombre_usuario = models.CharField(
        max_length=11,
        unique=True,
        null=True
    )



    oauth_provider = models.CharField(
        max_length=50,
        blank=True
    )

    oauth_id = models.CharField(
        max_length=255,
        blank=True
    )

    activo = models.BooleanField(
        default=True
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    ultimo_acceso = models.DateTimeField(
        null=True,
        blank=True
    )

    def str(self):
            if self.persona:
                return self.persona.dni
            return self.username
    class Meta:
            verbose_name = 'Usuario'
            verbose_name_plural = 'Usuarios'


class Rol(models.Model):

    nombre = models.CharField(
        max_length=50,
        unique=True
    )

    descripcion = models.CharField(
        max_length=255,
        blank=True
    )

    def __str__(self):
        return self.nombre

    class Meta:
            verbose_name = 'Rol'
            verbose_name_plural = 'Roles'



class Administrador(models.Model):

    persona = models.OneToOneField(
        Persona,
        on_delete=models.CASCADE
    )

    def __str__(self):
        return str(self.persona)

    class Meta:
            verbose_name = 'Administrador'
            verbose_name_plural = 'Administradores'        


