import hashlib
import math

from rest_framework.exceptions import Throttled
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle


def normalizar_identificador(valor):
    # Mayúsculas, espacios y puntos no crean una cuenta distinta (DNI "12.345.678" == "12345678")
    return str(valor).strip().lower().replace('.', '').replace(' ', '')


class LimitePorIdentificadorThrottle(ScopedRateThrottle):
    """Limita por cuenta (DNI o email del cuerpo), sin importar desde cuántas IPs llegue el pedido.

    La vista declara ``throttle_identificador = (campo, scope)``. La clave de caché es un hash:
    el identificador nunca se guarda ni se registra en claro.
    """

    def allow_request(self, request, view):
        configuracion = getattr(view, 'throttle_identificador', None)
        if not configuracion:
            return True
        campo, self.scope = configuracion
        datos = request.data
        valor = datos.get(campo) if hasattr(datos, 'get') else None
        if valor in (None, ''):
            return True  # sin identificador queda el límite por IP
        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)
        huella = hashlib.sha256(normalizar_identificador(valor).encode()).hexdigest()
        self.key = self.cache_format % {'scope': self.scope, 'ident': huella}
        self.history = self.cache.get(self.key, [])
        self.now = self.timer()
        while self.history and self.history[-1] <= self.now - self.duration:
            self.history.pop()
        if len(self.history) >= self.num_requests:
            return self.throttle_failure()
        return self.throttle_success()


class LimiteDeIntentosMixin:
    """Límite por IP (``throttle_scope``) y por cuenta (``throttle_identificador``). Las tasas están en
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']. Responde 429 con un ``detail`` en español."""

    throttle_classes = [ScopedRateThrottle, LimitePorIdentificadorThrottle]

    def throttled(self, request, wait):
        segundos = max(1, math.ceil(wait or 1))
        raise Throttled(
            wait=wait,
            detail=f'Demasiados intentos. Vuelva a intentarlo en {segundos} segundos.',
        )


class MensajesThrottle(UserRateThrottle):
    """Límite por usuario autenticado al enviar mensajes (scope ``mensajes``)."""

    scope = 'mensajes'
