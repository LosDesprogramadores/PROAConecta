from rest_framework.permissions import BasePermission

from .roles import (
    es_admin,
    es_estudiante,
    es_profesor,
    es_profesor_de_materia,
    obtener_persona_y_rol,
    tiene_inscripcion_activa,
)


def _autenticado(request):
    return bool(request.user and request.user.is_authenticated)


def _materia_de(obj):
    # Acepta la materia misma o un objeto que la referencia (inscripción, actividad, etc.)
    return getattr(obj, 'materia', obj)


class EsAdministrador(BasePermission):
    message = 'Solo un administrador puede realizar esta acción.'

    def has_permission(self, request, view):
        return _autenticado(request) and es_admin(request.user)


class EsProfesor(BasePermission):
    message = 'Solo un profesor puede realizar esta acción.'

    def has_permission(self, request, view):
        return _autenticado(request) and es_profesor(request.user)


class EsEstudiante(BasePermission):
    message = 'Solo un estudiante puede realizar esta acción.'

    def has_permission(self, request, view):
        return _autenticado(request) and es_estudiante(request.user)


class EsProfesorDeMateria(BasePermission):
    # Nivel objeto: el administrador pasa siempre, el profesor solo si es el titular
    message = 'Solo el profesor a cargo de esta materia puede realizar esta acción.'

    def has_permission(self, request, view):
        return _autenticado(request)

    def has_object_permission(self, request, view, obj):
        if not _autenticado(request):
            return False
        return es_admin(request.user) or es_profesor_de_materia(request.user, _materia_de(obj))


class EsInscripto(BasePermission):
    # Nivel objeto: el administrador pasa siempre, el estudiante solo con inscripción no BAJA
    message = 'Debes estar inscripto como estudiante en esta materia.'

    def has_permission(self, request, view):
        return _autenticado(request)

    def has_object_permission(self, request, view, obj):
        if not _autenticado(request):
            return False
        if es_admin(request.user):
            return True
        persona, rol = obtener_persona_y_rol(request.user)
        return rol == 'estudiante' and tiene_inscripcion_activa(persona, _materia_de(obj))
