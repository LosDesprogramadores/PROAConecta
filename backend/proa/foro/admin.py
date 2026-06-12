from django.contrib import admin
from .models import Foro, Publicacion, Comentario


admin.site.register(Foro)
admin.site.register(Publicacion)
admin.site.register(Comentario)