from django.db import models, transaction
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


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

    def soft_delete(self):
        # La baja desactiva la cuenta y revoca sus sesiones: el access ya emitido deja de valer
        # (is_active=False) y el refresh queda en la blacklist
        with transaction.atomic():
            self.fecha_baja = timezone.now().date()
            self.save(update_fields=['fecha_baja'])
            usuario = Usuario.objects.filter(persona=self).first()
            if usuario is not None:
                usuario.activo = False
                usuario.save()

    def restore(self):
        with transaction.atomic():
            self.fecha_baja = None
            self.save(update_fields=['fecha_baja'])
            usuario = Usuario.objects.filter(persona=self).first()
            if usuario is not None:
                usuario.activo = True
                usuario.is_active = True
                usuario.save()

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

    debe_cambiar_password = models.BooleanField(
        default=True
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    ultimo_acceso = models.DateTimeField(
        null=True,
        blank=True
    )

    def save(self, *args, **kwargs):
        # Una cuenta desactivada no puede usar su access (simplejwt valida is_active) ni renovar su refresh
        if not self.activo:
            self.is_active = False
            if kwargs.get('update_fields') is not None:
                kwargs['update_fields'] = {*kwargs['update_fields'], 'is_active'}
        super().save(*args, **kwargs)
        if not self.activo:
            from .services import revocar_sesiones

            revocar_sesiones(self, cerrar_sockets=True)

    def __str__(self):
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




