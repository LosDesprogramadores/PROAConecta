from django.contrib import admin
from usuario.models import *

# Register your models here.
admin.site.register(Persona)
admin.site.register(Usuario)
admin.site.register(Rol)
admin.site.register(UsuarioRol)
admin.site.register(Administrador)
admin.site.register(Docente)

