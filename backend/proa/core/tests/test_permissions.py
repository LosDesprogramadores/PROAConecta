import pytest
from django.contrib.auth.models import AnonymousUser
from rest_framework.test import APIRequestFactory

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from core import roles
from core.permissions import (
    EsAdministrador,
    EsEstudiante,
    EsInscripto,
    EsProfesor,
    EsProfesorDeMateria,
)
from usuario.tests.factories import RolFactory, UsuarioFactory

pytestmark = pytest.mark.django_db


def _request(usuario):
    request = APIRequestFactory().get('/')
    request.user = usuario
    return request


@pytest.fixture
def otro_profesor(rol_profesor):
    return UsuarioFactory(persona__rol=rol_profesor)


@pytest.fixture
def otro_estudiante(rol_estudiante):
    return UsuarioFactory(persona__rol=rol_estudiante)


# --- roles.py: el rol se resuelve por nombre, nunca por id ---

def test_es_admin_con_rol_administrador_de_id_distinto_a_uno_es_verdadero():
    # Un rol cuyo nombre normalizado es 'administrador' lo es sin importar su id
    otro = RolFactory(nombre=' administrador ', id=99)
    usuario = UsuarioFactory(persona__rol=otro)
    assert roles.es_admin(usuario) is True


def test_es_admin_con_rol_de_id_uno_pero_otro_nombre_es_falso(db):
    from usuario.models import Rol
    Rol.objects.filter(id=1).update(nombre='Auditor')
    usuario = UsuarioFactory(persona__rol=Rol.objects.get(id=1))
    assert roles.es_admin(usuario) is False


def test_es_admin_con_superusuario_sin_persona_es_verdadero(django_user_model):
    usuario = django_user_model.objects.create_superuser(username='root', password='Clave-de-prueba-123')
    assert roles.es_admin(usuario) is True


def test_es_admin_con_profesor_es_falso(profesor):
    assert roles.es_admin(profesor) is False


def test_obtener_persona_y_rol_devuelve_rol_normalizado(profesor):
    persona, rol = roles.obtener_persona_y_rol(profesor)
    assert persona == profesor.persona
    assert rol == roles.ROL_PROFESOR


def test_obtener_persona_y_rol_sin_persona_devuelve_nulos(django_user_model):
    usuario = django_user_model.objects.create_user(username='sinpersona', password='Clave-de-prueba-123')
    assert roles.obtener_persona_y_rol(usuario) == (None, None)


def test_es_profesor_y_es_estudiante_distinguen_roles(profesor, estudiante):
    assert roles.es_profesor(profesor) and not roles.es_estudiante(profesor)
    assert roles.es_estudiante(estudiante) and not roles.es_profesor(estudiante)


def test_es_profesor_de_materia_solo_para_el_titular(materia_con_inscripcion, profesor, otro_profesor):
    assert roles.es_profesor_de_materia(profesor, materia_con_inscripcion) is True
    assert roles.es_profesor_de_materia(otro_profesor, materia_con_inscripcion) is False


@pytest.mark.parametrize('estado, esperado', [
    (Inscripcion.EstadoInscripcion.CURSANDO, True),
    (Inscripcion.EstadoInscripcion.REGULAR, True),
    (Inscripcion.EstadoInscripcion.PROMOCIONADO, True),
    (Inscripcion.EstadoInscripcion.LIBRE, True),
    (Inscripcion.EstadoInscripcion.BAJA, False),
])
def test_tiene_inscripcion_activa_segun_estado(estudiante, estado, esperado):
    materia = MateriaFactory()
    InscripcionFactory(materia=materia, estudiante=estudiante.persona, estado=estado)
    assert roles.tiene_inscripcion_activa(estudiante.persona, materia) is esperado


def test_tiene_inscripcion_activa_sin_inscripcion_es_falso(estudiante):
    assert roles.tiene_inscripcion_activa(estudiante.persona, MateriaFactory()) is False


def test_tiene_inscripcion_activa_sin_persona_es_falso():
    assert roles.tiene_inscripcion_activa(None, MateriaFactory()) is False


# --- permissions.py: permisos por rol ---

@pytest.mark.parametrize('clase, fixture_permitido', [
    (EsAdministrador, 'admin'),
    (EsProfesor, 'profesor'),
    (EsEstudiante, 'estudiante'),
])
def test_permiso_por_rol_permite_solo_su_rol(clase, fixture_permitido, request, admin, profesor, estudiante):
    usuarios = {'admin': admin, 'profesor': profesor, 'estudiante': estudiante}
    for nombre, usuario in usuarios.items():
        permitido = clase().has_permission(_request(usuario), None)
        assert permitido is (nombre == fixture_permitido)


@pytest.mark.parametrize('clase', [EsAdministrador, EsProfesor, EsEstudiante])
def test_permiso_por_rol_deniega_al_anonimo(clase):
    assert clase().has_permission(_request(AnonymousUser()), None) is False


def test_es_profesor_de_materia_objeto_permite_titular_y_administrador(materia_con_inscripcion, profesor, admin):
    permiso = EsProfesorDeMateria()
    assert permiso.has_object_permission(_request(profesor), None, materia_con_inscripcion) is True
    assert permiso.has_object_permission(_request(admin), None, materia_con_inscripcion) is True


def test_es_profesor_de_materia_objeto_deniega_a_otro_profesor_y_estudiante(
    materia_con_inscripcion, otro_profesor, estudiante
):
    permiso = EsProfesorDeMateria()
    assert permiso.has_object_permission(_request(otro_profesor), None, materia_con_inscripcion) is False
    assert permiso.has_object_permission(_request(estudiante), None, materia_con_inscripcion) is False


def test_es_profesor_de_materia_resuelve_la_materia_desde_un_objeto_relacionado(materia_con_inscripcion, profesor):
    inscripcion = materia_con_inscripcion.inscripciones.first()
    assert EsProfesorDeMateria().has_object_permission(_request(profesor), None, inscripcion) is True


def test_es_inscripto_objeto_permite_al_inscripto_incluso_en_libre(estudiante):
    materia = MateriaFactory()
    InscripcionFactory(materia=materia, estudiante=estudiante.persona, estado=Inscripcion.EstadoInscripcion.LIBRE)
    assert EsInscripto().has_object_permission(_request(estudiante), None, materia) is True


def test_es_inscripto_objeto_deniega_con_baja_y_a_no_inscriptos(estudiante, otro_estudiante):
    materia = MateriaFactory()
    InscripcionFactory(materia=materia, estudiante=estudiante.persona, estado=Inscripcion.EstadoInscripcion.BAJA)
    permiso = EsInscripto()
    assert permiso.has_object_permission(_request(estudiante), None, materia) is False
    assert permiso.has_object_permission(_request(otro_estudiante), None, materia) is False


def test_es_inscripto_objeto_deniega_al_profesor_aunque_sea_titular(materia_con_inscripcion, profesor):
    assert EsInscripto().has_object_permission(_request(profesor), None, materia_con_inscripcion) is False


def test_es_inscripto_objeto_permite_al_administrador(materia_con_inscripcion, admin):
    assert EsInscripto().has_object_permission(_request(admin), None, materia_con_inscripcion) is True


# --- Cuentas dadas de baja o desactivadas no conservan rol ---

def test_obtener_persona_y_rol_sin_rol_si_el_usuario_esta_desactivado(admin):
    admin.activo = False
    admin.save(update_fields=['activo'])
    _, rol = roles.obtener_persona_y_rol(admin)
    assert rol is None


def test_obtener_persona_y_rol_sin_rol_si_la_persona_tiene_fecha_de_baja(admin):
    admin.persona.soft_delete()
    admin.refresh_from_db()
    _, rol = roles.obtener_persona_y_rol(admin)
    assert rol is None


def test_es_admin_es_falso_para_administrador_desactivado_o_dado_de_baja(admin, rol_administrador):
    desactivado = UsuarioFactory(persona__rol=rol_administrador, activo=False)
    de_baja = UsuarioFactory(persona__rol=rol_administrador)
    de_baja.persona.soft_delete()
    assert roles.es_admin(desactivado) is False
    assert roles.es_admin(de_baja) is False
    assert roles.es_admin(admin) is True


def test_superusuario_desactivado_no_es_admin(django_user_model):
    usuario = django_user_model.objects.create_superuser(username='root2', password='Clave-de-prueba-123')
    usuario.activo = False
    assert roles.es_admin(usuario) is False

