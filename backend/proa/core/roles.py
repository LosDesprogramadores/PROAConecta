# Los roles se resuelven por nombre (rol.nombre.strip().lower()), nunca por id: el id depende
# del orden en que se sembró la tabla y no es parte del contrato.
ROL_ADMINISTRADOR = 'administrador'
ROL_PROFESOR = 'profesor'
ROL_ESTUDIANTE = 'estudiante'


def obtener_persona_y_rol(user):
    persona = getattr(user, 'persona', None)
    rol = None
    # Una cuenta desactivada o una persona dada de baja no conserva rol, aunque su JWT siga vigente
    if not getattr(user, 'activo', True) or (persona and persona.fecha_baja):
        return persona, None
    if persona and persona.rol:
        rol = persona.rol.nombre.strip().lower()
    return persona, rol


def es_admin(user) -> bool:
    if not getattr(user, 'is_authenticated', False):
        return False
    _, rol = obtener_persona_y_rol(user)
    activo = getattr(user, 'activo', True)
    return bool(activo and (user.is_superuser or rol == ROL_ADMINISTRADOR))


def es_profesor(user) -> bool:
    _, rol = obtener_persona_y_rol(user)
    return rol == ROL_PROFESOR


def es_estudiante(user) -> bool:
    _, rol = obtener_persona_y_rol(user)
    return rol == ROL_ESTUDIANTE


def es_profesor_de_materia(user, materia) -> bool:
    persona, _ = obtener_persona_y_rol(user)
    return bool(persona and getattr(materia, 'profesor_id', None) == persona.id)


def tiene_inscripcion_activa(persona, materia) -> bool:
    # Import diferido: academico depende de usuario, que a su vez depende de core.
    # alumnos_de_materia excluye BAJA; LIBRE sigue siendo parte de la materia.
    if persona is None:
        return False
    from academico.selectors import alumnos_de_materia

    return alumnos_de_materia(materia).filter(estudiante=persona).exists()
