from django.contrib import admin
from .models import (
    Materia,
    Inscripcion,
    Material,
    Actividad,
    Entrega,
    Estado,
    CambioEstado,
    Nota,
)

admin.site.register(Materia)
admin.site.register(Inscripcion)
admin.site.register(Material)
admin.site.register(Actividad)
admin.site.register(Entrega)
admin.site.register(Estado)
admin.site.register(CambioEstado)
admin.site.register(Nota)