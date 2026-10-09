"""Matriz ejecutable de permisos: endpoint x método x actor (008/T012, #248).

Es la fuente de verdad de la autorización de la API (el contrato en prosa está en
planning/specs/002-seguridad-autorizacion/contracts/permission-matrix.md). Cada fila de ``MATRIZ`` declara
el código HTTP esperado para los 9 actores de ``ACTORES``.

Cómo se obliga a revisar la autorización de un endpoint nuevo:
``test_cada_endpoint_de_la_api_esta_en_la_matriz`` recorre el URLconf real y compara cada
(nombre de ruta, método) con las filas declaradas. Un endpoint o método sin fila hace fallar la suite
(y una fila de un endpoint que ya no existe también): no se puede agregar una ruta sin decidir quién entra.

En las escrituras se verifica además el estado: si la respuesta es denegada (o un 400) no cambió nada,
ni en la base relacional ni en MongoDB; si es 2xx, sí cambió algo.

Una sola escena compartida por módulo (dentro de una transacción que se revierte al final) y cada caso
corre en su propio savepoint, así las escrituras permitidas no se contaminan entre sí.
"""
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Optional

import pytest
from bson.objectid import ObjectId
from django.conf import settings
from django.db import transaction
from django.urls import URLPattern, URLResolver, get_resolver, resolve
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from academico.models import Inscripcion, Materia
from academico.tests.factories import InscripcionFactory, MateriaFactory
from aula_virtual.models import Actividad, Entrega, Material, Nota, Unidad
from notificacion import mongo
from usuario.models import Persona, Rol, Usuario
from usuario.tests.factories import PersonaFactory, RolFactory, UsuarioFactory

# --------------------------------------------------------------------------------------------------
# Actores y códigos
# --------------------------------------------------------------------------------------------------
ACTORES = (
    'anonimo',
    'cursando',      # estudiante inscripto (CURSANDO)
    'libre',         # estudiante LIBRE: conserva el acceso
    'baja',          # estudiante en BAJA: lo pierde
    'ajeno',         # estudiante sin inscripción en la materia
    'titular',       # profesor titular
    'prof_ajeno',    # profesor de otra materia
    'admin',         # administrador
    'inactivo',      # administrador con la cuenta desactivada (activo=False) y un access todavía firmado
)
ANONIMO, CURSANDO, LIBRE, BAJA, AJENO, TITULAR, PROF_AJENO, ADMIN, INACTIVO = range(len(ACTORES))

U = 401   # sin credenciales válidas
P = 403   # prohibido
N = 404   # fuera de alcance: no se confirma que exista
B = 400   # público: llega a la vista (sin cuerpo) y la validación lo rechaza
O = 200
C = 201
D = 204

METODOS_DE_ESCRITURA = {'POST', 'PUT', 'PATCH', 'DELETE'}
FUTURO = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()


@dataclass(frozen=True)
class Fila:
    nombre: str                          # nombre de la ruta en el URLconf (clave para el meta-test)
    metodo: str
    ruta: Callable                       # e -> '/api/...'
    esperado: tuple                      # un código por actor, en el orden de ACTORES
    cuerpo: Optional[Callable] = None    # e -> dict
    variante: str = ''                   # distingue dos filas de la misma ruta y método
    mongo: bool = False                  # reinicia y compara las colecciones de MongoDB
    archivos: bool = False               # escribe los archivos subidos antes de pedir
    sin_cambio: bool = False             # un 2xx no modifica la base (p. ej. emitir un ticket)

    @property
    def id(self):
        return f'{self.nombre}:{self.metodo}' + (f':{self.variante}' if self.variante else '')


def F(nombre, metodo, ruta, esperado, cuerpo=None, **opciones):
    return Fila(nombre, metodo, ruta, tuple(esperado), cuerpo, **opciones)


def PUT_Y_PATCH(nombre, ruta, esperado, cuerpo_put, cuerpo_patch, **opciones):
    return [
        F(nombre, 'PUT', ruta, esperado, cuerpo_put, **opciones),
        F(nombre, 'PATCH', ruta, esperado, cuerpo_patch, **opciones),
    ]


# --------------------------------------------------------------------------------------------------
# Escena compartida
# --------------------------------------------------------------------------------------------------
class Escena:
    pass


def _usuario(rol):
    return UsuarioFactory(persona__rol=rol)


def _crear_escena():
    e = Escena()
    e.rol_admin = RolFactory(nombre='Administrador')
    e.rol_profesor = RolFactory(nombre='Profesor')
    e.rol_estudiante = RolFactory(nombre='Estudiante')
    e.rol_extra = Rol.objects.create(nombre='Rol auxiliar de la matriz', descripcion='')

    # Un usuario por actor
    e.u = {
        'cursando': _usuario(e.rol_estudiante),
        'libre': _usuario(e.rol_estudiante),
        'baja': _usuario(e.rol_estudiante),
        'ajeno': _usuario(e.rol_estudiante),
        'titular': _usuario(e.rol_profesor),
        'prof_ajeno': _usuario(e.rol_profesor),
        'admin': _usuario(e.rol_admin),
        'inactivo': _usuario(e.rol_admin),
    }
    e.tokens = {nombre: str(AccessToken.for_user(usuario)) for nombre, usuario in e.u.items()}
    inactivo = e.u['inactivo']
    inactivo.activo = False  # el save() también pone is_active=False y revoca sus refresh
    inactivo.save()

    # Materias
    titular = e.u['titular'].persona
    e.m = MateriaFactory(profesor=titular, titulo='Materia de la matriz')
    e.m_ajena = MateriaFactory(profesor=e.u['prof_ajeno'].persona, titulo='Materia ajena')
    e.m_baja = MateriaFactory(profesor=titular, titulo='Materia en papelera')
    e.m_baja.soft_delete()

    # Inscripciones
    Estado = Inscripcion.EstadoInscripcion
    e.insc_cursando = InscripcionFactory(materia=e.m, estudiante=e.u['cursando'].persona)
    InscripcionFactory(materia=e.m, estudiante=e.u['libre'].persona, estado=Estado.LIBRE)
    InscripcionFactory(materia=e.m, estudiante=e.u['baja'].persona, estado=Estado.BAJA)
    # Estudiante sin notas para probar la desinscripción, y estudiante sin ninguna inscripción
    e.extra = PersonaFactory(rol=e.rol_estudiante)
    InscripcionFactory(materia=e.m, estudiante=e.extra)
    e.sin_inscripcion = PersonaFactory(rol=e.rol_estudiante)

    # Personas para las acciones del administrador
    e.persona_sin_usuario = PersonaFactory(rol=e.rol_estudiante)
    e.persona_borrable = _usuario(e.rol_estudiante).persona
    e.persona_de_baja = _usuario(e.rol_estudiante).persona
    e.persona_de_baja.soft_delete()

    # Contenido
    e.unidad = Unidad.objects.create(materia=e.m, titulo='Unidad 1', orden=1, visible=True)
    e.unidad_baja = Unidad.objects.create(materia=e.m, titulo='Unidad en papelera', orden=2, visible=True)
    e.unidad_baja.soft_delete()
    e.material = Material.objects.create(
        materia=e.m, unidad=e.unidad, titulo='Material 1', visible=True, archivo='materiales/matriz.txt',
    )
    e.material_baja = Material.objects.create(materia=e.m, titulo='Material en papelera', visible=True)
    e.material_baja.soft_delete()
    Publicada = Actividad.EstadoActividad.PUBLICADA
    e.actividad = Actividad.objects.create(
        materia=e.m, unidad=e.unidad, titulo='Actividad 1', estado=Publicada,
        fecha_limite=datetime.now(timezone.utc) + timedelta(days=30), archivo_adjunto='actividades/matriz.txt',
    )
    e.actividad2 = Actividad.objects.create(
        materia=e.m, titulo='Actividad 2', estado=Publicada,
        fecha_limite=datetime.now(timezone.utc) + timedelta(days=30),
    )
    e.actividad_baja = Actividad.objects.create(materia=e.m, titulo='Actividad en papelera', estado=Publicada)
    e.actividad_baja.soft_delete()

    # Entregas y nota
    Corregido = Entrega.EstadoEntrega.CORREGIDO
    e.entrega = Entrega.objects.create(
        actividad=e.actividad, estudiante=e.u['cursando'].persona, archivo='entregas/matriz.txt',
    )
    e.entrega_libre = Entrega.objects.create(
        actividad=e.actividad, estudiante=e.u['libre'].persona, estado=Corregido, contenido_texto='libre',
    )
    Nota.objects.create(entrega=e.entrega_libre, profesor=titular, calificacion='8.00')
    Entrega.objects.create(actividad=e.actividad, estudiante=e.u['baja'].persona, contenido_texto='baja')
    e.entrega_papelera = Entrega.objects.create(
        actividad=e.actividad, estudiante=e.extra, contenido_texto='papelera',
    )
    e.entrega_papelera.soft_delete()

    # MongoDB: ids fijos para que las rutas no cambien al reiniciar la colección
    e.id_notificacion_global = ObjectId()
    e.id_notificacion_materia = ObjectId()
    e.id_mensaje = ObjectId()
    return e


def _sembrar_mongo(e):
    ahora = datetime.now(timezone.utc)
    notificaciones = mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION)
    mensajes = mongo.obtener_coleccion(mongo.COLECCION_MENSAJE)
    for nombre in (mongo.COLECCION_NOTIFICACION, mongo.COLECCION_MENSAJE, mongo.COLECCION_BITACORA):
        mongo.obtener_coleccion(nombre).delete_many({})
    base = {
        'leida_por': [], 'fecha_creacion': ahora, 'fecha_desde': None, 'fecha_hasta': None,
        'referencia_tipo': None, 'referencia_id': None,
    }
    notificaciones.insert_many([
        {
            **base, '_id': e.id_notificacion_global, 'tipo_notificacion_codigo': 'GENERAL', 'alcance': 'AMBOS',
            'titulo': 'Aviso institucional', 'mensaje': 'Para todos', 'materia_id': None,
            'usuario_origen_id': e.u['admin'].pk, 'usuario_destino_id': e.u['admin'].pk,
        },
        {
            **base, '_id': e.id_notificacion_materia, 'tipo_notificacion_codigo': 'ANUNCIO', 'alcance': 'ESTUDIANTES',
            'titulo': 'Anuncio de la materia', 'mensaje': 'Solo la materia', 'materia_id': e.m.pk,
            'usuario_origen_id': e.u['titular'].pk, 'usuario_destino_id': e.u['titular'].pk,
        },
    ])
    mensajes.insert_one({
        '_id': e.id_mensaje, 'materia_id': e.m.pk, 'remitente_id': e.u['titular'].pk,
        'destinatario_id': e.u['cursando'].pk, 'asunto': 'Consulta', 'cuerpo': 'Hola',
        'fecha_creacion': ahora, 'leido': False, 'fecha_baja': None,
    })


@pytest.fixture(scope='module')
def escena(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock():
        envoltura = transaction.atomic()
        envoltura.__enter__()
        try:
            yield _crear_escena()
        finally:
            transaction.set_rollback(True)
            envoltura.__exit__(None, None, None)
            for nombre in (mongo.COLECCION_NOTIFICACION, mongo.COLECCION_MENSAJE, mongo.COLECCION_BITACORA):
                mongo.obtener_coleccion(nombre).delete_many({})


def _estado(con_mongo):
    """Foto de todo lo que una escritura podría tocar."""
    relacional = [
        list(manager.order_by('pk').values_list())
        for manager in (
            Materia.todas, Inscripcion.objects, Unidad.objects, Material.objects, Actividad.objects,
            Entrega.objects, Nota.objects, Persona.objects, Usuario.objects, Rol.objects,
        )
    ]
    if not con_mongo:
        return relacional
    colecciones = (mongo.COLECCION_NOTIFICACION, mongo.COLECCION_MENSAJE, mongo.COLECCION_BITACORA)
    return relacional + [list(mongo.obtener_coleccion(c).find().sort('_id')) for c in colecciones]


# --------------------------------------------------------------------------------------------------
# La matriz
# --------------------------------------------------------------------------------------------------
#                                      anon curs  libre baja  ajeno titul pajen admin inact
SOLO_ADMIN = (U, P, P, P, P, P, P, O, U)
AUTENTICADOS = (U, O, O, O, O, O, O, O, U)
PUBLICO = (B, B, B, B, B, B, B, B, B)
PUBLICO_OK = (O, O, O, O, O, O, O, O, O)  # público y sin cuerpo: 200 para todos, incluso el inactivo


def _api(*partes):
    return lambda e: '/api/' + ''.join(partes)


def _con(formato):
    return lambda e: formato.format(e=e)


MATRIZ = [
    # ---- usuario: sesión y cuentas ------------------------------------------------------------
    F('api-root', 'GET', _api(), AUTENTICADOS),
    F('login', 'POST', _api('auth/login/'), PUBLICO),                           # sin cuerpo: 400, nunca 401/403
    F('logout', 'POST', _api('auth/logout/'), PUBLICO),
    F('token_refresh', 'POST', _api('auth/refresh/'), PUBLICO),
    F('solicitar-recuperacion', 'POST', _api('auth/solicitar-recuperacion/'), PUBLICO),
    F('confirmar-recuperacion', 'POST', _api('auth/confirmar-recuperacion/'), PUBLICO),
    F('usuario-me', 'GET', _api('auth/me/'), AUTENTICADOS),
    F('cambiar-password-primer-ingreso', 'POST', _api('auth/cambiar-password-primer-ingreso/'),
      (U, B, B, B, B, B, B, B, U)),                                              # autenticado, cuerpo vacío
    F('usuario-create', 'POST', _api('usuarios/'), (U, P, P, P, P, P, P, C, U),
      lambda e: {'persona_id': e.persona_sin_usuario.pk, 'password': 'Clave-nueva-12345'}),
    F('persona_por_rol', 'GET', lambda e: f'/api/personas/rol/?rol={e.rol_estudiante.pk}', AUTENTICADOS),

    # ---- usuario: roles -----------------------------------------------------------------------
    F('rol-list', 'GET', _api('roles/'), AUTENTICADOS),
    F('rol-list', 'POST', _api('roles/'), (U, P, P, P, P, P, P, C, U),
      lambda e: {'nombre': 'Rol de la matriz', 'descripcion': ''}),
    F('rol-detail', 'GET', lambda e: f'/api/roles/{e.rol_extra.pk}/', AUTENTICADOS),
    *PUT_Y_PATCH('rol-detail', lambda e: f'/api/roles/{e.rol_extra.pk}/', SOLO_ADMIN,
                 lambda e: {'nombre': 'Rol editado', 'descripcion': ''}, lambda e: {'descripcion': 'editado'}),
    F('rol-detail', 'DELETE', lambda e: f'/api/roles/{e.rol_extra.pk}/', (U, P, P, P, P, P, P, D, U)),

    # ---- usuario: personas (la lectura es pública para autenticados pero sin datos personales ajenos)
    F('persona-list', 'GET', _api('personas/'), AUTENTICADOS),
    F('persona-list', 'POST', _api('personas/'), (U, P, P, P, P, P, P, C, U),
      lambda e: {
          'rol': e.rol_estudiante.pk, 'nombre': 'Nueva', 'apellido': 'Persona', 'dni': '39999991',
          'fecha_nacimiento': '2001-02-03', 'email': 'nueva.persona@ejemplo.test',
      }),
    F('persona-exportar', 'GET', _api('personas/exportar/'), SOLO_ADMIN),
    F('persona-detail', 'GET', lambda e: f'/api/personas/{e.persona_borrable.pk}/', AUTENTICADOS),
    *PUT_Y_PATCH(
        'persona-detail', lambda e: f'/api/personas/{e.persona_borrable.pk}/', SOLO_ADMIN,
        lambda e: {
            'rol': e.rol_estudiante.pk, 'nombre': 'Editado', 'apellido': e.persona_borrable.apellido,
            'dni': e.persona_borrable.dni, 'fecha_nacimiento': '2000-01-01', 'email': e.persona_borrable.email,
        },
        lambda e: {'nombre': 'Editado'},
    ),
    F('persona-detail', 'DELETE', lambda e: f'/api/personas/{e.persona_borrable.pk}/', SOLO_ADMIN),
    F('persona-restaurar', 'POST', lambda e: f'/api/personas/{e.persona_de_baja.pk}/restaurar/', SOLO_ADMIN),

    # ---- academico: materias ------------------------------------------------------------------
    F('materia-list', 'GET', _api('materias/'), AUTENTICADOS),
    F('materia-list', 'POST', _api('materias/'), (U, P, P, P, P, P, P, C, U),
      lambda e: {'titulo': 'Materia nueva', 'anio': 2026, 'curso': '3ro C'}),
    F('materia-asignar-profesor', 'POST', _api('materias/asignar-profesor/'), SOLO_ADMIN,
      lambda e: {'profesor_id': e.u['prof_ajeno'].persona.pk, 'materia_ids': [e.m.pk]}),
    F('materia-exportar', 'GET', _api('materias/exportar/'), SOLO_ADMIN),
    #                                                                          anon curs  libre baja  ajeno titul pajen admin inact
    F('materia-materias-por-estudiante', 'GET',
      lambda e: f'/api/materias/por-estudiante/{e.u["cursando"].persona.pk}/', (U, O, P, P, P, O, O, O, U)),
    F('materia-mi-boletin-exportar', 'GET', _api('materias/mi-boletin/exportar/'), (U, O, O, O, O, P, P, P, U)),
    F('materia-detail', 'GET', _con('/api/materias/{e.m.pk}/'), (U, O, O, N, N, O, N, O, U)),
    *PUT_Y_PATCH('materia-detail', _con('/api/materias/{e.m.pk}/'), SOLO_ADMIN,
                 lambda e: {'titulo': 'Materia editada', 'anio': 2026, 'curso': '1ro A'},
                 lambda e: {'descripcion': 'editada'}),
    F('materia-detail', 'DELETE', _con('/api/materias/{e.m.pk}/'), (U, P, P, P, P, P, P, D, U)),
    F('materia-alumnos', 'GET', _con('/api/materias/{e.m.pk}/alumnos/'), (U, P, P, P, P, O, P, O, U)),
    F('materia-desasignar-profesor', 'PATCH', _con('/api/materias/{e.m.pk}/desasignar-profesor/'), SOLO_ADMIN),
    F('materia-mi-rendimiento', 'GET', _con('/api/materias/{e.m.pk}/mi-rendimiento/'), (U, O, O, P, P, P, P, O, U)),
    F('materia-rendimiento-curso', 'GET', _con('/api/materias/{e.m.pk}/rendimiento-curso/'),
      (U, P, P, N, N, O, N, O, U)),
    F('materia-rendimiento-curso-exportar', 'GET', _con('/api/materias/{e.m.pk}/rendimiento-curso/exportar/'),
      (U, P, P, N, N, O, N, O, U)),
    F('materia-restaurar', 'POST', _con('/api/materias/{e.m_baja.pk}/restaurar/'), SOLO_ADMIN),

    # ---- academico: inscripciones -------------------------------------------------------------
    F('inscripcion-list', 'GET', _api('inscripciones/'), AUTENTICADOS),
    F('inscripcion-list', 'POST', _api('inscripciones/'), (U, P, P, P, P, P, P, C, U),
      lambda e: {'materia': e.m.pk, 'estudiante': e.sin_inscripcion.pk}),
    F('inscripcion-inscribir-lote', 'POST', _api('inscripciones/inscribir/'), (U, P, P, P, P, P, P, C, U),
      lambda e: {'estudiante_id': e.sin_inscripcion.pk, 'materia_ids': [e.m.pk]}),
    F('inscripcion-desinscribir-estudiante', 'POST', _api('inscripciones/desinscribir/'), SOLO_ADMIN,
      lambda e: {'estudiante_id': e.extra.pk, 'materia_id': e.m.pk}),
    F('inscripcion-detail', 'GET', _con('/api/inscripciones/{e.insc_cursando.pk}/'), (U, O, N, N, N, O, N, O, U)),
    *PUT_Y_PATCH(
        'inscripcion-detail', _con('/api/inscripciones/{e.insc_cursando.pk}/'), SOLO_ADMIN,
        lambda e: {'materia': e.m.pk, 'estudiante': e.u['cursando'].persona.pk, 'estado': 'REGULAR'},
        lambda e: {'estado': 'REGULAR'},
    ),
    F('inscripcion-detail', 'DELETE', _con('/api/inscripciones/{e.insc_cursando.pk}/'), (U, P, P, P, P, P, P, D, U)),

    # ---- aula_virtual: unidades ---------------------------------------------------------------
    #                                                  anon curs  libre baja  ajeno titul pajen admin inact
    F('unidad-list', 'GET', _api('unidades/'), AUTENTICADOS),
    F('unidad-list', 'POST', _api('unidades/'), (U, P, P, P, P, C, P, C, U),
      lambda e: {'materia': e.m.pk, 'titulo': 'Unidad nueva', 'orden': 2}),
    F('unidad-detail', 'GET', _con('/api/unidades/{e.unidad.pk}/'), (U, O, O, N, N, O, N, O, U)),
    *PUT_Y_PATCH('unidad-detail', _con('/api/unidades/{e.unidad.pk}/'), (U, P, P, N, N, O, N, O, U),
                 lambda e: {'materia': e.m.pk, 'titulo': 'Unidad editada', 'orden': 1},
                 lambda e: {'descripcion': 'editada'}),
    F('unidad-detail', 'DELETE', _con('/api/unidades/{e.unidad.pk}/'), (U, P, P, N, N, D, N, D, U)),
    F('unidad-cambiar-visibilidad', 'PATCH', _con('/api/unidades/{e.unidad.pk}/cambiar-visibilidad/'),
      (U, P, P, N, N, O, N, O, U)),
    F('unidad-restaurar', 'POST', _con('/api/unidades/{e.unidad_baja.pk}/restaurar/'), (U, P, P, P, P, O, P, O, U)),

    # ---- aula_virtual: materiales -------------------------------------------------------------
    F('material-list', 'GET', _api('materiales/'), AUTENTICADOS),
    F('material-list', 'POST', _api('materiales/'), (U, P, P, P, P, C, P, C, U),
      lambda e: {'materia': e.m.pk, 'titulo': 'Material nuevo', 'tipo': 'ENLACE', 'enlace': 'https://ejemplo.test/r'}),
    F('material-detail', 'GET', _con('/api/materiales/{e.material.pk}/'), (U, O, O, N, N, O, N, O, U)),
    *PUT_Y_PATCH('material-detail', _con('/api/materiales/{e.material.pk}/'), (U, P, P, N, N, O, N, O, U),
                 lambda e: {'materia': e.m.pk, 'titulo': 'Material editado', 'tipo': 'DOCUMENTO'},
                 lambda e: {'descripcion': 'editado'}),
    F('material-detail', 'DELETE', _con('/api/materiales/{e.material.pk}/'), (U, P, P, N, N, D, N, D, U)),
    F('material-cambiar-visibilidad', 'PATCH', _con('/api/materiales/{e.material.pk}/cambiar-visibilidad/'),
      (U, P, P, N, N, O, N, O, U)),
    F('material-restaurar', 'POST', _con('/api/materiales/{e.material_baja.pk}/restaurar/'),
      (U, P, P, P, P, O, P, O, U)),

    # ---- aula_virtual: actividades ------------------------------------------------------------
    F('actividad-list', 'GET', _api('actividades/'), AUTENTICADOS),
    F('actividad-list', 'POST', _api('actividades/'), (U, P, P, P, P, C, P, C, U),
      lambda e: {'materia': e.m.pk, 'titulo': 'Actividad nueva', 'estado': 'BORRADOR'}),
    F('actividad-detail', 'GET', _con('/api/actividades/{e.actividad.pk}/'), (U, O, O, N, N, O, N, O, U)),
    *PUT_Y_PATCH('actividad-detail', _con('/api/actividades/{e.actividad.pk}/'), (U, P, P, N, N, O, N, O, U),
                 lambda e: {'materia': e.m.pk, 'titulo': 'Actividad editada', 'estado': 'BORRADOR'},
                 lambda e: {'descripcion': 'editada'}),
    F('actividad-detail', 'DELETE', _con('/api/actividades/{e.actividad.pk}/'), (U, P, P, N, N, D, N, D, U)),
    F('actividad-restaurar', 'POST', _con('/api/actividades/{e.actividad_baja.pk}/restaurar/'),
      (U, P, P, P, P, O, P, O, U)),
    F('actividad-cambiar-estado', 'PATCH', _con('/api/actividades/{e.actividad.pk}/cambiar-estado/'),
      (U, P, P, N, N, O, N, O, U)),
    F('actividad-entregas', 'GET', _con('/api/actividades/{e.actividad.pk}/entregas/'), (U, P, P, N, N, O, N, O, U)),
    *[
        F('actividad-calificar-estudiante', metodo, _con('/api/actividades/{e.actividad.pk}/calificar-estudiante/'),
          (U, P, P, P, P, O, P, O, U),
          lambda e: {'estudiante_id': e.u['cursando'].persona.pk, 'calificacion': '8.00', 'descripcion': 'ok'})
        for metodo in ('POST', 'PUT')
    ],

    # ---- aula_virtual: entregas ---------------------------------------------------------------
    #                                               anon curs  libre baja  ajeno titul pajen admin inact
    F('entrega-list', 'GET', _api('entregas/'), AUTENTICADOS),
    F('entrega-list', 'POST', _api('entregas/'), (U, C, C, P, P, P, P, P, U),
      lambda e: {'actividad': e.actividad2.pk, 'contenido_texto': 'mi entrega'}),
    F('entrega-detail', 'GET', _con('/api/entregas/{e.entrega.pk}/'), (U, O, N, N, N, O, N, O, U)),
    *PUT_Y_PATCH('entrega-detail', _con('/api/entregas/{e.entrega.pk}/'), (U, O, N, N, N, P, P, P, U),
                 lambda e: {'actividad': e.actividad.pk, 'contenido_texto': 'editado'},
                 lambda e: {'contenido_texto': 'editado'}),
    F('entrega-detail', 'DELETE', _con('/api/entregas/{e.entrega.pk}/'), (U, D, N, N, N, D, N, D, U)),
    F('entrega-restaurar', 'POST', _con('/api/entregas/{e.entrega_papelera.pk}/restaurar/'),
      (U, P, P, P, P, O, P, O, U)),
    *[
        F('entrega-calificar', metodo, _con('/api/entregas/{e.entrega.pk}/calificar/'), (U, P, N, N, N, O, N, O, U),
          lambda e: {'calificacion': '7.50', 'descripcion': 'bien'})
        for metodo in ('POST', 'PUT', 'PATCH')
    ],

    # ---- aula_virtual: descarga autorizada de archivos ----------------------------------------
    F('descarga-archivo', 'GET', _con('/api/archivos/material/{e.material.pk}/'), (U, O, O, N, N, O, N, O, U),
      variante='material', archivos=True),
    F('descarga-archivo', 'GET', _con('/api/archivos/actividad/{e.actividad.pk}/'), (U, O, O, N, N, O, N, O, U),
      variante='actividad', archivos=True),
    F('descarga-archivo', 'GET', _con('/api/archivos/entrega/{e.entrega.pk}/'), (U, O, N, N, N, O, N, O, U),
      variante='entrega', archivos=True),

    # ---- notificacion -------------------------------------------------------------------------
    F('notificacion-list-create', 'GET', _api('notificaciones/'), AUTENTICADOS, mongo=True),
    F('notificacion-list-create', 'POST', _api('notificaciones/'), (U, P, P, P, P, P, P, C, U),
      lambda e: {'titulo': 'Aviso nuevo', 'mensaje': 'Texto', 'alcance': 'AMBOS', 'tipo_notificacion_codigo': 'GENERAL'},
      mongo=True),
    F('notificacion-leer', 'POST', _con('/api/notificaciones/{e.id_notificacion_global}/leer/'),
      AUTENTICADOS, variante='global', mongo=True),                       # institucional: alcanza a todos los roles
    F('notificacion-leer', 'POST', _con('/api/notificaciones/{e.id_notificacion_materia}/leer/'),
      (U, O, O, N, N, O, N, O, U), variante='materia', mongo=True),       # de la materia: BAJA y ajenos no la ven
    F('notificacion-detail', 'PUT', _con('/api/notificaciones/{e.id_notificacion_global}/'), SOLO_ADMIN,
      lambda e: {'titulo': 'Aviso editado'}, mongo=True),
    F('notificacion-detail', 'DELETE', _con('/api/notificaciones/{e.id_notificacion_global}/'), SOLO_ADMIN,
      mongo=True),
    F('materia-anuncios', 'GET', _con('/api/materias/{e.m.pk}/anuncios/'), (U, O, O, N, N, O, P, O, U), mongo=True),
    F('materia-anuncios', 'POST', _con('/api/materias/{e.m.pk}/anuncios/'), (U, P, P, P, P, C, P, P, U),
      lambda e: {'titulo': 'Anuncio', 'mensaje': 'Texto'}, mongo=True),
    F('ws-ticket', 'POST', _api('ws/ticket/'), AUTENTICADOS, sin_cambio=True),

    # ---- mensajeria ---------------------------------------------------------------------------
    F('materia-destinatarios', 'GET', _con('/api/materias/{e.m.pk}/destinatarios/'), (U, O, O, P, P, O, P, P, U)),
    F('mensaje-list-create', 'GET', _api('mensajes/'), (U, O, O, O, O, O, O, P, U), mongo=True),
    F('mensaje-list-create', 'POST', _api('mensajes/'), (U, P, P, P, P, C, P, P, U),
      lambda e: {'materia_id': e.m.pk, 'destinatario_id': e.u['cursando'].pk, 'asunto': 'Aviso', 'cuerpo': 'Hola'},
      variante='a-estudiante', mongo=True),
    F('mensaje-list-create', 'POST', _api('mensajes/'), (U, C, C, P, P, P, P, P, U),
      lambda e: {'materia_id': e.m.pk, 'destinatario_id': e.u['titular'].pk, 'asunto': 'Duda', 'cuerpo': 'Hola'},
      variante='a-titular', mongo=True),
    F('mensaje-leer', 'POST', _con('/api/mensajes/{e.id_mensaje}/leer/'), (U, O, N, N, N, N, N, N, U), mongo=True),
    F('mensaje-detail', 'DELETE', _con('/api/mensajes/{e.id_mensaje}/'), (U, N, N, N, N, D, N, N, U), mongo=True),

    # ---- auditoria ----------------------------------------------------------------------------
    F('auditoria-eventos', 'GET', _api('auditoria/eventos/'), SOLO_ADMIN, mongo=True),

    # ---- salud ---------------------------------------------------------------------------------
    F('salud', 'GET', _api('health/'), PUBLICO_OK),

    # ---- documentación de la API ---------------------------------------------------------------
    # SEC-25: la suite corre con DOCS_API_PUBLICAS=False (como producción), así que las tres rutas responden 404
    # a todos, incluido el administrador. El modo desarrollo (abiertas) lo cubre test_documentacion_api.py
    F('schema', 'GET', _api('schema/'), (N, N, N, N, N, N, N, N, N)),
    F('swagger-ui', 'GET', _api('schema/swagger-ui/'), (N, N, N, N, N, N, N, N, N)),
    F('redoc', 'GET', _api('schema/redoc/'), (N, N, N, N, N, N, N, N, N)),
]

# Rutas que no entran en la matriz por actor, con el motivo
FUERA_DE_LA_MATRIZ = {
    'admin/': 'Django admin: autenticación por sesión y is_staff; lo cubre test_el_admin_de_django_exige_sesion_de_staff',
}


# --------------------------------------------------------------------------------------------------
# Meta-tests: la matriz es completa y coherente
# --------------------------------------------------------------------------------------------------
def _patrones(patrones, prefijo=''):
    for patron in patrones:
        if isinstance(patron, URLResolver):
            yield from _patrones(patron.url_patterns, prefijo + str(patron.pattern))
        elif isinstance(patron, URLPattern):
            yield prefijo + str(patron.pattern), patron


def _metodos(patron):
    vista = patron.callback
    acciones = getattr(vista, 'actions', None)
    if acciones:
        return {m.upper() for m in acciones if m != 'head'}  # HEAD lo deriva DRF de GET
    clase = getattr(vista, 'cls', None)
    return {m.upper() for m in clase.http_method_names if m not in ('options', 'head') and hasattr(clase, m)}


# Duplicados que DRF genera para cada ruta del router (``format_suffix_patterns``): son la misma vista con
# ``.json`` al final. Solo estas dos formas se excluyen; cualquier otra ruta con "format" cuenta
SUFIJOS_DE_FORMATO = ('\\.(?P<format>[a-z0-9]+)/?$', '<drf_format_suffix:format>')


def _es_sufijo_de_formato(ruta):
    return any(sufijo in ruta for sufijo in SUFIJOS_DE_FORMATO)


def endpoints_expuestos():
    """(ruta, método) de todo lo que el URLconf publica. Toda ruta debe tener nombre (no se admiten anónimas)."""
    expuestos = set()
    sin_nombre = []
    for ruta, patron in _patrones(get_resolver().url_patterns):
        if any(ruta.startswith(prefijo) for prefijo in FUERA_DE_LA_MATRIZ) or _es_sufijo_de_formato(ruta):
            continue
        if patron.name is None:
            sin_nombre.append(ruta)
        for metodo in _metodos(patron):
            expuestos.add((_normalizar(ruta), metodo))
    assert not sin_nombre, f'Rutas sin name (la matriz y el frontend las identifican por nombre): {sin_nombre}'
    return expuestos


def _normalizar(ruta):
    # El URLconf junta partes con y sin anclas (^ y $) según vengan de path() o de un router
    return ruta.replace('^', '').replace('$', '')


def endpoints_declarados(escena, filas):
    """(ruta, método) de las filas, resolviendo cada URL concreta contra el URLconf real."""
    declarados = set()
    for fila in filas:
        coincidencia = resolve(fila.ruta(escena).split('?')[0])
        assert coincidencia.url_name == fila.nombre, f'{fila.id}: la URL resuelve a {coincidencia.url_name}'
        declarados.add((_normalizar(coincidencia.route), fila.metodo))
    return declarados


def verificar_cobertura(expuestos, declarados):
    sin_fila = sorted(expuestos - declarados)
    huerfanas = sorted(declarados - expuestos)
    assert not sin_fila, (
        'Endpoints nuevos sin fila en MATRIZ (decidí quién puede usarlos y declaralo en '
        f'core/tests/test_matriz_permisos.py): {sin_fila}'
    )
    assert not huerfanas, f'Filas de MATRIZ para endpoints que ya no existen: {huerfanas}'


def test_cada_endpoint_de_la_api_esta_en_la_matriz(escena, db):
    verificar_cobertura(endpoints_expuestos(), endpoints_declarados(escena, MATRIZ))


def test_un_endpoint_sin_fila_hace_fallar_la_cobertura(escena, db, monkeypatch):
    expuestos = endpoints_expuestos()
    declarados = endpoints_declarados(escena, MATRIZ)

    # Un endpoint nuevo que nadie declaró
    monkeypatch.setattr(sys.modules[__name__], 'endpoints_expuestos', lambda: expuestos | {('api/nuevo/', 'GET')})
    with pytest.raises(AssertionError, match='sin fila'):
        verificar_cobertura(endpoints_expuestos(), declarados)

    # Un método nuevo en una ruta que ya existe
    with pytest.raises(AssertionError, match='sin fila'):
        verificar_cobertura(expuestos | {('api/materias/', 'TRACE')}, declarados)

    # Una fila de un endpoint que desapareció
    with pytest.raises(AssertionError, match='ya no existen'):
        verificar_cobertura(expuestos - {next(iter(expuestos))}, declarados)


def test_los_duplicados_con_sufijo_de_formato_no_cuentan_pero_las_demas_rutas_si():
    assert _es_sufijo_de_formato('api/^materias\\.(?P<format>[a-z0-9]+)/?$')
    assert _es_sufijo_de_formato('api/<drf_format_suffix:format>')
    assert not _es_sufijo_de_formato('api/formato/exportar/')


def test_cada_fila_declara_un_codigo_por_actor_y_no_hay_ids_repetidos():
    assert all(len(fila.esperado) == len(ACTORES) for fila in MATRIZ)
    ids = [fila.id for fila in MATRIZ]
    assert len(ids) == len(set(ids))


def test_mongo_arranca_vacio_en_cada_test():
    # El conftest vacía notificacion, mensaje y bitacora antes y después de cada test
    for nombre in (mongo.COLECCION_NOTIFICACION, mongo.COLECCION_MENSAJE, mongo.COLECCION_BITACORA):
        assert mongo.obtener_coleccion(nombre).count_documents({}) == 0, nombre


PUBLICOS_SIN_AUTENTICACION = {'login', 'logout', 'token_refresh', 'solicitar-recuperacion', 'confirmar-recuperacion'}
SALUD = {'salud'}  # healthcheck: sin autenticación, 200 para todos
DOCUMENTACION = {'schema', 'swagger-ui', 'redoc'}  # apagadas fuera de desarrollo: 404 para todos


def test_reglas_transversales_de_la_tabla():
    for fila in MATRIZ:
        if fila.nombre in PUBLICOS_SIN_AUTENTICACION:
            assert set(fila.esperado) == {B}, fila.id  # ignoran las credenciales: ni 401 ni 403 para nadie
        elif fila.nombre in SALUD:
            assert set(fila.esperado) == {O}, fila.id
        elif fila.nombre in DOCUMENTACION:
            assert set(fila.esperado) == {N}, fila.id
        else:
            # Una cuenta desactivada y un anónimo no entran a nada aunque el access siga firmado
            assert fila.esperado[INACTIVO] == U and fila.esperado[ANONIMO] == U, fila.id


def test_el_admin_de_django_exige_sesion_de_staff(escena, db):
    for nombre in ACTORES:
        cliente = APIClient()
        if nombre != 'anonimo':
            cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {escena.tokens[nombre]}')
        respuesta = cliente.get('/admin/')
        assert respuesta.status_code == 302 and '/admin/login/' in respuesta['Location'], nombre


# --------------------------------------------------------------------------------------------------
# Los casos: una fila x un actor
# --------------------------------------------------------------------------------------------------
CASOS = [
    pytest.param(fila, actor, id=f'{fila.id}-{ACTORES[actor]}')
    for fila in MATRIZ
    for actor in range(len(ACTORES))
]


def _escribir_archivos(e):
    for nombre in ('materiales/matriz.txt', 'actividades/matriz.txt', 'entregas/matriz.txt'):
        destino = Path(settings.MEDIA_ROOT) / nombre
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(b'contenido de prueba')


@pytest.mark.parametrize('fila, actor', CASOS)
def test_matriz_de_permisos(escena, db, fila, actor):
    if fila.mongo:
        _sembrar_mongo(escena)
    if fila.archivos:
        _escribir_archivos(escena)

    cliente = APIClient()
    nombre_actor = ACTORES[actor]
    if nombre_actor != 'anonimo':
        cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {escena.tokens[nombre_actor]}')

    antes = _estado(fila.mongo)
    datos = fila.cuerpo(escena) if fila.cuerpo else None
    respuesta = getattr(cliente, fila.metodo.lower())(fila.ruta(escena), datos, format='json')
    despues = _estado(fila.mongo)

    esperado = fila.esperado[actor]
    assert respuesta.status_code == esperado, (
        f'{fila.id} como {nombre_actor}: esperaba {esperado} y respondió {respuesta.status_code} '
        f'{getattr(respuesta, "data", None)}'
    )

    if fila.metodo in METODOS_DE_ESCRITURA:
        if esperado < 300 and not fila.sin_cambio:
            assert antes != despues, f'{fila.id} como {nombre_actor}: respondió {esperado} pero no cambió nada'
        elif esperado >= 300:
            assert antes == despues, f'{fila.id} como {nombre_actor}: fue denegado ({esperado}) pero modificó el estado'
