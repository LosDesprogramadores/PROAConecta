"""Formato de error único y rango de notas compartido (X-21, GAP-01, TSK145)."""
import logging
import re
from decimal import Decimal
from pathlib import Path

import pytest
from django.conf import settings
from django.db.models import ProtectedError
from django.http import Http404
from rest_framework import exceptions, serializers

from aula_virtual.helpers import NOTA_MAXIMA, NOTA_MINIMA, validar_rango_nota
from academico.tests.factories import InscripcionFactory, MateriaFactory
from core.exceptions import manejador_de_excepciones
from usuario.tests.factories import PersonaFactory


def _manejar(error):
    return manejador_de_excepciones(error, {'view': None, 'request': None})


# --- el handler ---

def test_el_handler_esta_configurado_en_rest_framework():
    assert settings.REST_FRAMEWORK['EXCEPTION_HANDLER'] == 'core.exceptions.manejador_de_excepciones'


def test_un_mensaje_suelto_sale_como_detail():
    respuesta = _manejar(exceptions.ValidationError('Algo salió mal.'))

    assert (respuesta.status_code, respuesta.data) == (400, {'detail': 'Algo salió mal.'})


def test_varios_mensajes_sueltos_se_unen_en_un_detail():
    respuesta = _manejar(exceptions.ValidationError(['Primero.', 'Segundo.']))

    assert respuesta.data == {'detail': 'Primero. Segundo.'}


def test_los_errores_por_campo_salen_siempre_como_lista():
    respuesta = _manejar(exceptions.ValidationError({'calificacion': 'Mal', 'titulo': ['Falta', 'Corto']}))

    assert respuesta.data == {'calificacion': ['Mal'], 'titulo': ['Falta', 'Corto']}


def test_un_detail_dentro_de_un_diccionario_se_aplana_a_texto():
    respuesta = _manejar(exceptions.ValidationError({'detail': ['No se puede.']}))

    assert respuesta.data == {'detail': 'No se puede.'}


def test_non_field_errors_pasa_a_detail_y_conserva_los_campos():
    respuesta = _manejar(exceptions.ValidationError({'non_field_errors': ['Duplicado.'], 'anio': ['Inválido.']}))

    assert respuesta.data == {'detail': 'Duplicado.', 'anio': ['Inválido.']}


def test_los_errores_anidados_de_listas_se_conservan():
    respuesta = _manejar(exceptions.ValidationError({'items': [{'a': ['x']}, {}]}))

    assert respuesta.data == {'items': [{'a': ['x']}, {}]}


def test_el_error_de_un_serializer_real_pasa_por_el_formato_comun():
    class Entrada(serializers.Serializer):
        nombre = serializers.CharField()

        def validate(self, attrs):
            raise serializers.ValidationError('Regla general.')

    faltante = Entrada(data={})
    with pytest.raises(exceptions.ValidationError) as error:
        faltante.is_valid(raise_exception=True)
    general = Entrada(data={'nombre': 'x'})
    with pytest.raises(exceptions.ValidationError) as error_general:
        general.is_valid(raise_exception=True)

    assert _manejar(error.value).data == {'nombre': ['Este campo es requerido.']}
    assert _manejar(error_general.value).data == {'detail': 'Regla general.'}


@pytest.mark.parametrize('error,estado', [
    (Http404(), 404),
    (exceptions.NotFound(), 404),
    (exceptions.PermissionDenied(), 403),
    (exceptions.NotAuthenticated(), 401),
    (exceptions.MethodNotAllowed('PATCH'), 405),
])
def test_los_errores_conocidos_de_drf_mantienen_su_estado_y_traen_detail(error, estado):
    respuesta = _manejar(error)

    assert respuesta.status_code == estado
    assert set(respuesta.data) == {'detail'}
    assert isinstance(respuesta.data['detail'], str)


def test_throttled_conserva_retry_after():
    respuesta = _manejar(exceptions.Throttled(wait=30, detail='Demasiados intentos.'))

    assert respuesta.status_code == 429
    assert set(respuesta.data) == {'detail'}
    assert str(respuesta.data['detail']).startswith('Demasiados intentos.')
    assert respuesta['Retry-After'] == '30'


def test_un_json_mal_formado_no_expone_el_mensaje_del_parser():
    respuesta = _manejar(exceptions.ParseError('JSON parse error - Expecting value: line 1 column 1 (char 0)'))

    assert respuesta.status_code == 400
    assert respuesta.data == {'detail': 'El cuerpo de la solicitud no es válido.'}


def test_una_proteccion_de_borrado_responde_409():
    respuesta = _manejar(ProtectedError('no se puede', set()))

    assert respuesta.status_code == 409
    assert respuesta.data == {'detail': 'No se puede eliminar: hay registros que dependen de este.'}


def test_un_error_inesperado_responde_500_sin_datos_internos_y_se_registra(caplog):
    with caplog.at_level(logging.ERROR, logger='core.exceptions'):
        respuesta = _manejar(RuntimeError('SELECT password FROM usuario WHERE dni=1'))

    assert respuesta.status_code == 500
    assert respuesta.data == {'detail': 'Ocurrió un error interno. Intenta nuevamente más tarde.'}
    assert 'password' not in str(respuesta.data)
    assert 'RuntimeError' in caplog.text  # el detalle técnico va solo al log


# --- integración: ninguna respuesta de error usa claves distintas ---


@pytest.mark.django_db
def test_json_mal_formado_en_un_endpoint_real_responde_detail(api_as, admin):
    respuesta = api_as(admin).generic(
        'POST', '/api/materias/', '{no es json', content_type='application/json'
    )

    assert respuesta.status_code == 400
    assert respuesta.json() == {'detail': 'El cuerpo de la solicitud no es válido.'}


@pytest.mark.django_db
def test_respuestas_de_error_reales_no_usan_error_ni_message(api_as, admin, estudiante, cliente_anonimo):
    casos = [
        cliente_anonimo.get('/api/materias/'),
        api_as(estudiante).delete('/api/materias/1/'),
        api_as(admin).get('/api/materias/999999/'),
        api_as(admin).post('/api/materias/', {}, format='json'),
        api_as(admin).post('/api/inscripciones/desinscribir/', {}, format='json'),
        api_as(admin).get('/api/personas/rol/'),
        api_as(estudiante).post('/api/auth/cambiar-password-primer-ingreso/', {}, format='json'),
        api_as(admin).post('/api/actividades/1/calificar-estudiante/', {}, format='json'),
    ]

    for respuesta in casos:
        assert respuesta.status_code >= 400
        cuerpo = respuesta.json()
        assert 'message' not in cuerpo and 'mensaje' not in cuerpo
        assert 'error' not in cuerpo


@pytest.mark.django_db
@pytest.mark.parametrize('ruta,cuerpo', [
    ('/api/auth/cambiar-password-primer-ingreso/', {}),
    ('/api/auth/cambiar-password-primer-ingreso/', {'password_actual': 'incorrecta', 'password_nuevo': 'Nueva-clave-123'}),
])
def test_cambio_de_clave_trae_solo_detail(api_as, estudiante, ruta, cuerpo):
    respuesta = api_as(estudiante).post(ruta, cuerpo, format='json')

    assert respuesta.status_code == 400
    assert respuesta.json()['detail']
    assert 'error' not in respuesta.json()


@pytest.mark.django_db
def test_recuperacion_trae_solo_detail(cliente_anonimo):
    solicitar = cliente_anonimo.post('/api/auth/solicitar-recuperacion/', {}, format='json')
    confirmar = cliente_anonimo.post('/api/auth/confirmar-recuperacion/', {}, format='json')

    for respuesta in (solicitar, confirmar):
        assert respuesta.status_code == 400
        assert respuesta.json()['detail']
        assert 'error' not in respuesta.json()


@pytest.mark.django_db
def test_desinscribir_exitoso_usa_mensaje(api_as, admin, rol_estudiante):
    estudiante = PersonaFactory(rol=rol_estudiante)
    materia = MateriaFactory()
    InscripcionFactory(materia=materia, estudiante=estudiante)

    respuesta = api_as(admin).post(
        '/api/inscripciones/desinscribir/', {'estudiante_id': estudiante.pk, 'materia_id': materia.pk}, format='json'
    )

    assert respuesta.status_code == 200
    assert respuesta.json() == {'mensaje': 'Estudiante desinscripto correctamente.'}


def test_ninguna_vista_devuelve_str_de_la_excepcion():
    raiz = Path(__file__).resolve().parents[2]
    patron = re.compile(r'Response\([^)]*str\((e|exc|err|error|ex)\b')
    culpables = [
        str(ruta.relative_to(raiz))
        for ruta in raiz.rglob('*.py')
        if 'tests' not in ruta.parts and 'migrations' not in ruta.parts and patron.search(ruta.read_text())
    ]

    assert culpables == []


# --- rango de notas compartido ---

def test_las_constantes_del_rango_de_notas():
    assert NOTA_MINIMA == Decimal('1.00')
    assert NOTA_MAXIMA == Decimal('10.00')


@pytest.mark.parametrize('valor', ['1', '1.00', 5.5, '10', '10.00'])
def test_valores_dentro_del_rango_se_aceptan(valor):
    assert NOTA_MINIMA <= validar_rango_nota(valor) <= NOTA_MAXIMA


@pytest.mark.parametrize('valor', ['0', '0.99', '10.01', '-3', '11'])
def test_valores_fuera_del_rango_se_rechazan_con_el_rango_en_el_mensaje(valor):
    with pytest.raises(exceptions.ValidationError) as error:
        validar_rango_nota(valor)

    mensaje = str(error.value.detail['calificacion'])
    assert f'{NOTA_MINIMA}' in mensaje and f'{NOTA_MAXIMA}' in mensaje


@pytest.mark.parametrize('valor', ['abc', None, ''])
def test_un_valor_no_numerico_se_rechaza(valor):
    with pytest.raises(exceptions.ValidationError):
        validar_rango_nota(valor)


@pytest.mark.django_db
def test_calificar_fuera_de_rango_responde_error_por_campo(api_as, profesor, estudiante, materia_con_inscripcion):
    from aula_virtual.models import Actividad

    actividad = Actividad.objects.create(materia=materia_con_inscripcion, titulo='TP')

    respuesta = api_as(profesor).post(
        f'/api/actividades/{actividad.pk}/calificar-estudiante/',
        {'estudiante_id': estudiante.persona.pk, 'calificacion': 0},
        format='json',
    )

    assert respuesta.status_code == 400
    assert respuesta.json() == {'calificacion': ['La calificación debe estar comprendida entre 1.00 y 10.00.']}


# --- documentación de la API ---

@pytest.mark.django_db
def test_los_endpoints_tocados_documentan_su_entrada_y_el_error(admin, api_as):
    esquema = api_as(admin).get('/api/schema/?format=json').json()
    rutas = esquema['paths']

    operaciones = [
        rutas['/api/auth/cambiar-password-primer-ingreso/']['post'],
        rutas['/api/auth/solicitar-recuperacion/']['post'],
        rutas['/api/auth/confirmar-recuperacion/']['post'],
        rutas['/api/inscripciones/desinscribir/']['post'],
        rutas['/api/inscripciones/inscribir/']['post'],
        rutas['/api/materias/asignar-profesor/']['post'],
        rutas['/api/actividades/{id}/calificar-estudiante/']['post'],
    ]
    for operacion in operaciones:
        assert 'requestBody' in operacion
        assert '400' in operacion['responses']
