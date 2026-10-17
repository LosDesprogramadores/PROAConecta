from rest_framework.exceptions import PermissionDenied, ValidationError
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

# Los helpers de rol viven en core/roles.py; se reexportan para no romper los imports existentes
from core.roles import tiene_inscripcion_activa
from core.roles import es_admin, es_estudiante, es_profesor, es_profesor_de_materia, obtener_persona_y_rol  # noqa: F401


# Escala de calificaciones: única fuente del rango. El formulario del profesor (min, max y step) debe
# coincidir con estos valores (frontend: actividad-entregas, a cargo de Maxi en T062)
NOTA_MINIMA = Decimal('1.00')
NOTA_MAXIMA = Decimal('10.00')


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

    if nota < NOTA_MINIMA or nota > NOTA_MAXIMA:
        raise ValidationError({
            'calificacion': f'La calificación debe estar comprendida entre {NOTA_MINIMA} y {NOTA_MAXIMA}.'
        })
    
    return nota

def verificar_estudiante_materia(user, materia):
    if es_admin(user):
        return
    persona, rol = obtener_persona_y_rol(user)
    if rol != 'estudiante' or not tiene_inscripcion_activa(persona, materia):
        raise PermissionDenied("Debes estar inscripto como estudiante en esta materia.")



def calcular_promedio(calificaciones: list) -> str | None:
    if not calificaciones:
        return None
    total = sum(Decimal(str(c)) for c in calificaciones)
    prom = total / Decimal(len(calificaciones))
    return str(prom.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))