"""Autenticación de la API: JWT que además exige haber cambiado la clave provisoria.

Se resuelve al autenticar y no con una permission por defecto porque muchas vistas declaran su propio
``permission_classes`` y eso descartaría la permission global; ``authentication_classes`` solo lo cambian las
vistas públicas, que no autentican a nadie.
"""
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

CODIGO_CAMBIO_DE_CLAVE = 'cambio_de_clave_requerido'
MENSAJE_CAMBIO_DE_CLAVE = 'Debes cambiar tu contraseña provisoria antes de continuar.'


class JWTConCambioDeClave(JWTAuthentication):
    """Con ``debe_cambiar_password=True`` solo deja pasar a las vistas con ``permite_clave_provisoria = True``."""

    def authenticate(self, request):
        resultado = super().authenticate(request)
        if resultado is None:
            return None

        usuario, _ = resultado
        # El usuario sale de la base en cada pedido: un access emitido antes del cambio no queda desactualizado
        vista = (getattr(request, 'parser_context', None) or {}).get('view')
        if usuario.debe_cambiar_password and not getattr(vista, 'permite_clave_provisoria', False):
            raise PermissionDenied({'detail': MENSAJE_CAMBIO_DE_CLAVE, 'code': CODIGO_CAMBIO_DE_CLAVE})
        return resultado
