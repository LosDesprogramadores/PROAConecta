import pytest
from rest_framework.test import APIRequestFactory

from usuario.models import Persona, Rol
from usuario.serializers import PersonaSerializer, UsuarioSerializer
from usuario.tests.factories import PersonaFactory, UsuarioFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def persona_sin_usuario(rol_estudiante):
    return PersonaFactory(rol=rol_estudiante)


def _datos_persona(rol, sufijo='x'):
    return {
        'nombre': 'Nueva',
        'apellido': 'Persona',
        'dni': f'4000000{sufijo}',
        'fecha_nacimiento': '2001-02-03',
        'email': f'nueva{sufijo}@ejemplo.test',
        'rol': rol.id,
    }


# --- Exploits: un no administrador no puede escalar privilegios ni alterar a otros ---

def test_estudiante_cambiar_su_propio_rol_recibe_403_y_el_rol_no_cambia(api_as, estudiante, rol_administrador):
    respuesta = api_as(estudiante).patch(
        f'/api/personas/{estudiante.persona.id}/', {'rol': rol_administrador.id}, format='json'
    )

    assert respuesta.status_code == 403
    estudiante.persona.refresh_from_db()
    assert estudiante.persona.rol.nombre == 'Estudiante'


def test_estudiante_reemplazar_su_persona_con_put_recibe_403(api_as, estudiante, rol_administrador):
    datos = _datos_persona(rol_administrador)
    respuesta = api_as(estudiante).put(f'/api/personas/{estudiante.persona.id}/', datos, format='json')

    assert respuesta.status_code == 403


def test_estudiante_cambiar_el_email_de_otra_persona_recibe_403(api_as, estudiante, persona_sin_usuario):
    correo_original = persona_sin_usuario.email
    respuesta = api_as(estudiante).patch(
        f'/api/personas/{persona_sin_usuario.id}/', {'email': 'atacante@ejemplo.test'}, format='json'
    )

    assert respuesta.status_code == 403
    persona_sin_usuario.refresh_from_db()
    assert persona_sin_usuario.email == correo_original


def test_estudiante_dar_de_baja_o_restaurar_una_persona_recibe_403(api_as, estudiante, persona_sin_usuario):
    cliente = api_as(estudiante)

    assert cliente.delete(f'/api/personas/{persona_sin_usuario.id}/').status_code == 403
    assert cliente.post(f'/api/personas/{persona_sin_usuario.id}/restaurar/').status_code == 403
    persona_sin_usuario.refresh_from_db()
    assert persona_sin_usuario.fecha_baja is None


@pytest.mark.parametrize('fixture_usuario', ['profesor', 'estudiante'])
def test_no_admin_crear_persona_recibe_403(request, api_as, rol_estudiante, fixture_usuario):
    usuario = request.getfixturevalue(fixture_usuario)
    respuesta = api_as(usuario).post('/api/personas/', _datos_persona(rol_estudiante), format='json')

    assert respuesta.status_code == 403
    assert not Persona.objects.filter(email='nuevax@ejemplo.test').exists()


@pytest.mark.parametrize('fixture_usuario', ['profesor', 'estudiante'])
def test_no_admin_crear_usuario_recibe_403(request, api_as, persona_sin_usuario, fixture_usuario):
    usuario = request.getfixturevalue(fixture_usuario)
    respuesta = api_as(usuario).post(
        '/api/usuarios/',
        {'persona_id': persona_sin_usuario.id, 'password': 'Clave-de-prueba-123'},
        format='json',
    )

    assert respuesta.status_code == 403
    persona_sin_usuario.refresh_from_db()
    assert not hasattr(persona_sin_usuario, 'usuario')


@pytest.mark.parametrize('fixture_usuario', ['profesor', 'estudiante'])
def test_no_admin_escribir_roles_recibe_403(request, api_as, fixture_usuario, rol_profesor):
    cliente = api_as(request.getfixturevalue(fixture_usuario))

    assert cliente.post('/api/roles/', {'nombre': 'Intruso'}, format='json').status_code == 403
    assert cliente.put(f'/api/roles/{rol_profesor.id}/', {'nombre': 'Intruso'}, format='json').status_code == 403
    assert cliente.patch(f'/api/roles/{rol_profesor.id}/', {'nombre': 'Intruso'}, format='json').status_code == 403
    assert cliente.delete(f'/api/roles/{rol_profesor.id}/').status_code == 403
    rol_profesor.refresh_from_db()
    assert rol_profesor.nombre == 'Profesor'
    assert not Rol.objects.filter(nombre='Intruso').exists()


def test_anonimo_no_puede_escribir_personas_ni_roles_ni_usuarios(cliente_anonimo, rol_profesor):
    assert cliente_anonimo.post('/api/personas/', {}, format='json').status_code == 401
    assert cliente_anonimo.post('/api/usuarios/', {}, format='json').status_code == 401
    assert cliente_anonimo.put(f'/api/roles/{rol_profesor.id}/', {}, format='json').status_code == 401


# --- La lectura sigue abierta a cualquier usuario autenticado ---

@pytest.mark.parametrize('ruta', ['/api/personas/', '/api/roles/'])
def test_estudiante_puede_seguir_leyendo_personas_y_roles(api_as, estudiante, ruta):
    assert api_as(estudiante).get(ruta).status_code == 200


# --- El administrador conserva todas las operaciones ---

def test_admin_crea_persona_y_su_usuario_con_clave_provisoria(api_as, admin, rol_estudiante):
    respuesta = api_as(admin).post('/api/personas/', _datos_persona(rol_estudiante), format='json')

    assert respuesta.status_code == 201
    persona = Persona.objects.get(email='nuevax@ejemplo.test')
    assert persona.rol == rol_estudiante
    assert persona.usuario.debe_cambiar_password is True


def test_admin_cambia_rol_y_email_de_una_persona(api_as, admin, persona_sin_usuario, rol_profesor):
    respuesta = api_as(admin).patch(
        f'/api/personas/{persona_sin_usuario.id}/',
        {'rol': rol_profesor.id, 'email': 'cambiado@ejemplo.test'},
        format='json',
    )

    assert respuesta.status_code == 200
    persona_sin_usuario.refresh_from_db()
    assert persona_sin_usuario.rol == rol_profesor
    assert persona_sin_usuario.email == 'cambiado@ejemplo.test'


def test_admin_da_de_baja_y_restaura_una_persona(api_as, admin, persona_sin_usuario):
    cliente = api_as(admin)

    assert cliente.delete(f'/api/personas/{persona_sin_usuario.id}/').status_code == 200
    persona_sin_usuario.refresh_from_db()
    assert persona_sin_usuario.fecha_baja is not None
    assert cliente.post(f'/api/personas/{persona_sin_usuario.id}/restaurar/').status_code == 200
    persona_sin_usuario.refresh_from_db()
    assert persona_sin_usuario.fecha_baja is None


def test_admin_crea_usuario_para_una_persona(api_as, admin, persona_sin_usuario):
    respuesta = api_as(admin).post(
        '/api/usuarios/',
        {'persona_id': persona_sin_usuario.id, 'password': 'Clave-de-prueba-123'},
        format='json',
    )

    assert respuesta.status_code == 201
    persona_sin_usuario.refresh_from_db()
    assert persona_sin_usuario.usuario.username == persona_sin_usuario.dni


def test_admin_crea_edita_y_borra_roles(api_as, admin):
    cliente = api_as(admin)

    creado = cliente.post('/api/roles/', {'nombre': 'Preceptor'}, format='json')
    assert creado.status_code == 201
    ruta = f"/api/roles/{creado.data['id']}/"
    assert cliente.put(ruta, {'nombre': 'Preceptora'}, format='json').status_code == 200
    assert cliente.delete(ruta).status_code == 204


# --- Serializers: campos explícitos y de privilegio de solo lectura para no administradores ---

def _contexto(usuario):
    request = APIRequestFactory().patch('/')
    request.user = usuario
    return {'request': request}


def test_serializers_escribibles_no_usan_all_ni_exponen_campos_implicitos():
    assert PersonaSerializer.Meta.fields != '__all__'
    assert UsuarioSerializer.Meta.fields != '__all__'
    assert 'password' not in PersonaSerializer().fields


@pytest.mark.parametrize('campo', ['rol', 'dni', 'email', 'fecha_baja'])
def test_persona_serializer_marca_de_solo_lectura_los_campos_de_privilegio_para_no_admin(estudiante, campo):
    serializer = PersonaSerializer(estudiante.persona, context=_contexto(estudiante))

    assert serializer.fields[campo].read_only is True


@pytest.mark.parametrize('campo', ['rol', 'dni', 'email', 'fecha_baja'])
def test_persona_serializer_deja_escribibles_los_campos_para_admin(admin, estudiante, campo):
    serializer = PersonaSerializer(estudiante.persona, context=_contexto(admin))

    assert serializer.fields[campo].read_only is False


def test_persona_serializer_sin_contexto_trata_los_campos_como_de_solo_lectura(estudiante):
    assert PersonaSerializer(estudiante.persona).fields['rol'].read_only is True


def test_persona_serializer_ignora_rol_e_email_enviados_por_un_no_admin(estudiante, rol_administrador):
    serializer = PersonaSerializer(
        estudiante.persona,
        data={'rol': rol_administrador.id, 'email': 'otro@ejemplo.test', 'nombre': 'Cambiado'},
        partial=True,
        context=_contexto(estudiante),
    )

    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data == {'nombre': 'Cambiado'}


def test_usuario_serializer_marca_activo_de_solo_lectura_para_no_admin(estudiante):
    serializer = UsuarioSerializer(context=_contexto(estudiante))

    assert serializer.fields['activo'].read_only is True


def test_usuario_serializer_deja_activo_escribible_para_admin(admin):
    assert UsuarioSerializer(context=_contexto(admin)).fields['activo'].read_only is False

# --- Cuentas desactivadas o dadas de baja pierden el acceso de administrador ---

@pytest.mark.parametrize('motivo', ['desactivado', 'dado_de_baja'])
def test_administrador_desactivado_o_dado_de_baja_recibe_403_en_escritura_de_admin(api_as, rol_administrador, motivo):
    usuario = UsuarioFactory(persona__rol=rol_administrador, activo=(motivo != 'desactivado'))
    if motivo == 'dado_de_baja':
        usuario.persona.soft_delete()
    respuesta = api_as(usuario).post('/api/roles/', {'nombre': 'Intruso'}, format='json')
    assert respuesta.status_code == 403
