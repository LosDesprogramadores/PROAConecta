# from django.db import models

# from django.db import models


# class Foro(models.Model):
#     materia = models.ForeignKey(
#         'academico.Materia',
#         on_delete=models.CASCADE,
#         related_name='foros'
#     )
#     nombre = models.CharField(max_length=150)
#     descripcion = models.TextField(null=True, blank=True)
#     fecha_creacion = models.DateTimeField(auto_now_add=True)
#     fecha_cierre = models.DateTimeField(null=True, blank=True)

#     class Meta:
#         db_table = 'foro'

#     def __str__(self):
#         return f'{self.nombre} - {self.materia}'


# class Publicacion(models.Model):
#     foro = models.ForeignKey(
#         Foro,
#         on_delete=models.CASCADE,
#         related_name='publicaciones'
#     )
#     docente = models.ForeignKey(
#         'usuario.Docente',
#         on_delete=models.CASCADE,
#         related_name='publicaciones'
#     )
#     titulo = models.CharField(max_length=150)
#     contenido = models.TextField()
#     visible = models.BooleanField(default=True)
#     fecha_publicacion = models.DateTimeField(auto_now_add=True)
#     fecha_modificacion = models.DateTimeField(null=True, blank=True)
#     fecha_eliminacion = models.DateTimeField(null=True, blank=True)

#     class Meta:
#         db_table = 'publicacion'

#     def __str__(self):
#         return self.titulo


# class Comentario(models.Model):
#     publicacion = models.ForeignKey(
#         Publicacion,
#         on_delete=models.CASCADE,
#         related_name='comentarios'
#     )
#     estudiante = models.ForeignKey(
#         'usuario.Estudiante',
#         on_delete=models.CASCADE,
#         related_name='comentarios'
#     )
#     descripcion = models.TextField()
#     fecha_publicacion = models.DateTimeField(auto_now_add=True)
#     fecha_modificacion = models.DateTimeField(null=True, blank=True)
#     fecha_eliminacion = models.DateTimeField(null=True, blank=True)

#     class Meta:
#         db_table = 'comentario'

#     def __str__(self):
#         return f'{self.estudiante} - {self.publicacion}'