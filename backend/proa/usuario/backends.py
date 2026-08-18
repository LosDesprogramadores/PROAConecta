from django.contrib.auth.backends import ModelBackend
from .models import Persona


class DNIBackend(ModelBackend):

    def authenticate(self, request, dni=None, password=None, **kwargs):
        if dni is None or password is None:
            return None

        try:
            persona = Persona.objects.select_related('usuario').get(dni=dni)
        except Persona.DoesNotExist:
            return None

        usuario = getattr(persona, 'usuario', None)
        if usuario is None:
            return None

        if usuario.check_password(password) and self.user_can_authenticate(usuario):
            return usuario

        return None