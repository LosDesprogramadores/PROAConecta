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

    Cada pedido reserva su cupo al entrar con un contador atómico (``cache.add`` + ``cache.incr``), de modo
    que pedidos concurrentes no pasan todos antes de que se registre ninguno. La ventana es fija: arranca
    con el primer pedido y vence a los ``duration`` segundos. Una vista que solo quiere contar fallos llama a
    ``limpiar`` cuando la autenticación tiene éxito, y en la práctica quedan contados solo los fallos.
    """

    def _preparar(self, request, view):
        configuracion = getattr(view, 'throttle_identificador', None)
        if not configuracion:
            return False
        campo, self.scope = configuracion
        datos = request.data
        valor = datos.get(campo) if hasattr(datos, 'get') else None
        if valor in (None, ''):
            return False  # sin identificador queda el límite por IP
        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)
        huella = hashlib.sha256(normalizar_identificador(valor).encode()).hexdigest()
        self.key = self.cache_format % {'scope': self.scope, 'ident': huella}
        self.key_inicio = f'{self.key}:inicio'
        self.now = self.timer()
        return True

    def _reservar(self):
        """Suma este pedido al contador y devuelve el total de la ventana."""
        if self.cache.add(self.key, 0, self.duration):
            self.cache.add(self.key_inicio, self.now, self.duration)
        try:
            return self.cache.incr(self.key)
        except ValueError:  # la ventana venció entre el add y el incr: se abre otra sin pisar pedidos concurrentes
            self.cache.add(self.key, 0, self.duration)
            self.cache.add(self.key_inicio, self.now, self.duration)
            return self.cache.incr(self.key)

    def allow_request(self, request, view):
        if not self._preparar(request, view):
            return True
        if self._reservar() > self.num_requests:
            return self.throttle_failure()
        return True

    def wait(self):
        inicio = self.cache.get(self.key_inicio)
        if inicio is None:
            return self.duration
        return max(1, inicio + self.duration - self.timer())

    def limpiar(self, request, view):
        if self._preparar(request, view):
            self.cache.delete_many([self.key, self.key_inicio])


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
