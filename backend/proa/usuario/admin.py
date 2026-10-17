from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from usuario.models import *


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ('username', 'persona', 'activo', 'debe_cambiar_password', 'is_staff')
    search_fields = ('username', 'persona__dni', 'persona__apellido')
    fieldsets = UserAdmin.fieldsets + (
        ('PROA', {'fields': ('persona', 'nombre_usuario', 'activo', 'debe_cambiar_password')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('PROA', {'fields': ('persona', 'nombre_usuario')}),
    )


admin.site.register(Persona)
admin.site.register(Rol)
