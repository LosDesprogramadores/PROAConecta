"""Aislamiento de los endpoints de la spec 010 con tokens Bearer reales (010/T041, #338).

La matriz de permisos usa force_authenticate, que se salta ``JWTConCambioDeClave``. Aquí cada pedido
lleva un access token firmado, así se ejercita la cadena de autenticación completa.
"""
from datetime import datetime, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from aula_virtual.models import Actividad, Entrega
from mensajeria import repositorio
from notificacion import mongo
from usuario.tests.factories import UsuarioFactory

pytestmark = pytest.mark.django_db

CODIGO_CLAVE = 'cambio_de_clave_requerido'


def con_token(usuario):
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(usuario)}')
    return cliente


@pytest.fixture
def otro_profesor(rol_profesor):
    return UsuarioFactory(persona__rol=rol_profesor)


@pytest.fixture
def actividad(materia_con_inscripcion):
    return Actividad.objects.create(
        materia=materia_con_inscripcion, titulo='Tarea', fecha_limite=timezone.now() + timedelta(days=7),
        estado=Actividad.EstadoActividad.PUBLICADA,
    )


# ---- seguimiento y entregas ---------------------------------------------------------------------
def test_profesor_ajeno_no_ve_el_seguimiento_de_otra_actividad(actividad, otro_profesor):
    respuesta = con_token(otro_profesor).get(f'/api/actividades/{actividad.pk}/seguimiento/')
    assert respuesta.status_code == 404


def test_estudiante_no_ve_el_seguimiento(actividad, estudiante):
    assert con_token(estudiante).get(f'/api/actividades/{actividad.pk}/seguimiento/').status_code == 403


def test_titular_si_ve_el_seguimiento_con_token_real(actividad, profesor):
    assert con_token(profesor).get(f'/api/actividades/{actividad.pk}/seguimiento/').status_code == 200


def test_listado_de_entregas_del_profesor_excluye_materias_ajenas_aun_filtrando_por_ellas(
    actividad, estudiante, profesor, otro_profesor
):
    Entrega.objects.create(actividad=actividad, estudiante=estudiante.persona, contenido_texto='x')
    cliente = con_token(otro_profesor)

    for consulta in ('', f'?materia={actividad.materia_id}', f'?materia={actividad.materia_id}&calificada=false',
                     f'?actividad={actividad.pk}'):
        respuesta = cliente.get(f'/api/entregas/{consulta}')
        assert respuesta.status_code == 200, consulta
        cuerpo = respuesta.json()
        filas = cuerpo['results'] if isinstance(cuerpo, dict) else cuerpo
        assert filas == [], consulta

    propio = con_token(profesor).get(f'/api/entregas/?materia={actividad.materia_id}').json()
    filas = propio['results'] if isinstance(propio, dict) else propio
    assert len(filas) == 1


def test_estudiante_solo_ve_sus_entregas_en_el_listado(actividad, estudiante, rol_estudiante, materia_con_inscripcion):
    otro = UsuarioFactory(persona__rol=rol_estudiante)
    InscripcionFactory(materia=materia_con_inscripcion, estudiante=otro.persona)
    Entrega.objects.create(actividad=actividad, estudiante=otro.persona, contenido_texto='del otro')

    cuerpo = con_token(estudiante).get('/api/entregas/').json()
    filas = cuerpo['results'] if isinstance(cuerpo, dict) else cuerpo
    assert filas == []


# ---- inscribir-estudiantes ----------------------------------------------------------------------
@pytest.mark.parametrize('quien', ['profesor', 'estudiante'])
def test_inscribir_estudiantes_rechaza_a_los_no_administradores(request, quien, materia_con_inscripcion, rol_estudiante):
    usuario = request.getfixturevalue(quien)
    nuevo = UsuarioFactory(persona__rol=rol_estudiante)

    respuesta = con_token(usuario).post(
        '/api/inscripciones/inscribir-estudiantes/',
        {'materia_id': materia_con_inscripcion.pk, 'estudiante_ids': [nuevo.persona.pk]}, format='json',
    )

    assert respuesta.status_code == 403
    assert not Inscripcion.objects.filter(materia=materia_con_inscripcion, estudiante=nuevo.persona).exists()


def test_inscribir_estudiantes_rechaza_el_pedido_anonimo(cliente_anonimo, materia_con_inscripcion):
    respuesta = cliente_anonimo.post(
        '/api/inscripciones/inscribir-estudiantes/',
        {'materia_id': materia_con_inscripcion.pk, 'estudiante_ids': [1]}, format='json',
    )
    assert respuesta.status_code == 401


# ---- notificaciones -----------------------------------------------------------------------------
def _aviso(titulo, **campos):
    doc = {'titulo': titulo, 'mensaje': 'm', 'alcance': 'AMBOS', 'materia_id': None,
           'fecha_creacion': datetime(2026, 1, 1), 'leida_por': []}
    doc.update(campos)
    mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION).insert_one(doc)


def test_estudiante_no_recibe_avisos_para_profesores_ni_en_el_listado_ni_filtrado(estudiante, admin):
    _aviso('para-profesores', alcance='PROFESOR', usuario_origen_id=admin.pk)
    _aviso('para-estudiantes', alcance='ESTUDIANTE', usuario_origen_id=admin.pk)
    cliente = con_token(estudiante)

    for consulta in ('', '?no_leidas=true', '?vigentes=true&no_leidas=true'):
        titulos = {n['titulo'] for n in cliente.get(f'/api/notificaciones/{consulta}').json()}
        assert 'para-profesores' not in titulos, consulta
        assert 'para-estudiantes' in titulos, consulta


@pytest.mark.parametrize('quien', ['profesor', 'estudiante'])
def test_propias_de_un_no_administrador_no_devuelve_avisos_de_otros(request, quien, admin):
    usuario = request.getfixturevalue(quien)
    _aviso('del-admin', usuario_origen_id=admin.pk)

    respuesta = con_token(usuario).get('/api/notificaciones/?propias=true')

    assert respuesta.status_code == 200
    assert respuesta.json() == []


# ---- conversación -------------------------------------------------------------------------------
def test_un_tercero_no_lee_la_conversacion_entre_otras_dos_personas(
    materia_con_inscripcion, profesor, estudiante, rol_estudiante
):
    espia = UsuarioFactory(persona__rol=rol_estudiante)
    InscripcionFactory(materia=materia_con_inscripcion, estudiante=espia.persona)
    repositorio.crear({
        'materia_id': materia_con_inscripcion.pk, 'remitente_id': profesor.pk, 'destinatario_id': estudiante.pk,
        'asunto': 'Privado', 'cuerpo': 'secreto', 'leido': False, 'fecha_baja': None,
        'fecha_creacion': datetime(2026, 10, 1, 12, 0),
    })
    cliente = con_token(espia)

    # El hilo es siempre entre quien pide y `con`: el espía solo ve el suyo con el profesor (vacío)
    propio = cliente.get('/api/mensajes/conversacion/', {'materia': materia_con_inscripcion.pk, 'con': profesor.pk})
    assert propio.status_code == 200
    assert propio.json() == []
    # Con otro estudiante no hay par válido: 404 uniforme
    ajeno = cliente.get('/api/mensajes/conversacion/', {'materia': materia_con_inscripcion.pk, 'con': estudiante.pk})
    assert ajeno.status_code == 404
    assert 'secreto' not in propio.content.decode() + ajeno.content.decode()


def test_profesor_ajeno_no_lee_la_conversacion_de_otra_materia(
    materia_con_inscripcion, profesor, estudiante, otro_profesor
):
    repositorio.crear({
        'materia_id': materia_con_inscripcion.pk, 'remitente_id': profesor.pk, 'destinatario_id': estudiante.pk,
        'asunto': 'Privado', 'cuerpo': 'secreto', 'leido': False, 'fecha_baja': None,
        'fecha_creacion': datetime(2026, 10, 1, 12, 0),
    })
    respuesta = con_token(otro_profesor).get(
        '/api/mensajes/conversacion/', {'materia': materia_con_inscripcion.pk, 'con': estudiante.pk},
    )
    # No pertenece a la materia: 404 uniforme, sin importar quién sea `con`
    assert respuesta.status_code == 404
    assert respuesta.json() == {'detail': 'No se encontró la conversación.'}
    assert 'secreto' not in respuesta.content.decode()


# ---- clave provisoria ---------------------------------------------------------------------------
@pytest.mark.parametrize('metodo, ruta', [
    ('get', '/api/actividades/1/seguimiento/'),
    ('get', '/api/entregas/?materia=1&calificada=false'),
    ('get', '/api/notificaciones/?propias=true'),
    ('get', '/api/mensajes/conversacion/?materia=1&con=1'),
    ('post', '/api/inscripciones/inscribir-estudiantes/'),
    ('delete', '/api/materias/1/'),
])
def test_endpoints_nuevos_exigen_cambiar_la_clave_provisoria(metodo, ruta, rol_administrador):
    usuario = UsuarioFactory(persona__rol=rol_administrador, debe_cambiar_password=True)

    respuesta = getattr(con_token(usuario), metodo)(ruta)

    assert respuesta.status_code == 403
    assert respuesta.data['code'] == CODIGO_CLAVE


# ---- baja de materia ----------------------------------------------------------------------------
def test_profesor_no_puede_borrar_una_materia(profesor):
    materia = MateriaFactory(profesor=profesor.persona)
    assert con_token(profesor).delete(f'/api/materias/{materia.pk}/').status_code == 403
