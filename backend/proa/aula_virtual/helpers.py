from rest_framework.exceptions import PermissionDenied, ValidationError
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

def obtener_persona_y_rol(user):
    persona = getattr(user, 'persona', None)
    rol = None
    if persona and persona.rol:
        rol = persona.rol.nombre.strip().lower()
    return persona, rol


def es_admin(user) -> bool:
    persona, _ = obtener_persona_y_rol(user)
    return bool(user.is_staff or user.is_superuser or (persona and persona.rol_id == 1))


def es_profesor(user) -> bool:
    _, rol = obtener_persona_y_rol(user)
    return rol == 'profesor'


def es_estudiante(user) -> bool:
    _, rol = obtener_persona_y_rol(user)
    return rol == 'estudiante'


def verificar_profesor_materia(user, materia):
    if es_admin(user):
        return
    persona, _ = obtener_persona_y_rol(user)
    if not persona or getattr(materia, 'profesor_id', None) != persona.id:
        raise PermissionDenied("Solo el profesor a cargo de esta materia puede realizar esta acción.")


def validar_rango_nota(valor):
    try:
        nota = Decimal(str(valor))
    except (InvalidOperation, TypeError):
        raise ValidationError({'calificacion': 'La calificación debe ser un valor numérico válido.'})

    if nota < Decimal('1.00') or nota > Decimal('10.00'):
        raise ValidationError({'calificacion': 'La calificación debe estar comprendida entre 1.00 y 10.00.'})
    
    return nota

def verificar_estudiante_materia(user, materia):
    if es_admin(user):
        return
    persona, rol = obtener_persona_y_rol(user)
    if rol != 'estudiante' or not materia.estudiantes.filter(id=getattr(persona, 'id', None)).exists():
        raise PermissionDenied("Debes estar inscripto como estudiante en esta materia.")



def calcular_promedio(calificaciones: list) -> str | None:
    if not calificaciones:
        return None
    total = sum(Decimal(str(c)) for c in calificaciones)
    prom = total / Decimal(len(calificaciones))
    return str(prom.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))