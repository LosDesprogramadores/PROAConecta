from django.contrib.auth.backends import ModelBackend
from .models import Persona, Usuario


class DNIBackend(ModelBackend):

    @staticmethod
    def _hash_ficticio(password):
        # El mismo costo que verificar una clave real: el tiempo no distingue DNI inexistente de clave errónea
        Usuario().set_password(password)

    def authenticate(self, request, dni=None, password=None, **kwargs):
        if dni is None or password is None:
            return None

        # Una persona dada de baja no puede iniciar sesión
        try:
            persona = Persona.objects.select_related('usuario').get(dni=dni, fecha_baja__isnull=True)
        except Persona.DoesNotExist:
            self._hash_ficticio(password)
            return None

        usuario = getattr(persona, 'usuario', None)
        if usuario is None:
            self._hash_ficticio(password)
            return None

        # Una cuenta inactiva responde igual que una clave errónea: no revela que el DNI existe
        if usuario.check_password(password) and usuario.activo and self.user_can_authenticate(usuario):
            return usuario

        return None