from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as ErrorDeValidacion

from core.throttling import normalizar_identificador


def error_de_clave_nueva(password_nuevo, usuario):
    """Mensaje si la clave nueva no cumple los validadores de Django o es igual al DNI; si no, ``None``.

    La comparación con el DNI usa la misma normalización que el límite por cuenta (espacios, puntos y
    mayúsculas no hacen distinta a la clave)."""
    persona = getattr(usuario, 'persona', None)
    if persona is not None and normalizar_identificador(password_nuevo) == normalizar_identificador(persona.dni):
        return 'La nueva contraseña no puede ser igual al DNI.'
    try:
        validate_password(password_nuevo, user=usuario)
    except ErrorDeValidacion as error:
        return ' '.join(error.messages)
    return None
