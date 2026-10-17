"""Correo y Discord fuera del ciclo del request (BE-10, TSK143)."""
import logging
import threading
import time
from smtplib import SMTPException
from unittest import mock

import pytest
from django.core import mail
from django.db import transaction

from integraciones.fondo import ejecutar_en_segundo_plano
from notificacion import mongo
from usuario.models import Persona, Usuario

ESPERA_MAXIMA = 5


@pytest.fixture
def en_hilo(settings):
    # La suite corre los envíos en línea; estos tests ejercitan el hilo real
    settings.SEGUNDO_PLANO_SINCRONO = False


@pytest.fixture(autouse=True)
def coleccion_vacia():
    coleccion = mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION)
    coleccion.delete_many({})
    yield
    coleccion.delete_many({})


def _datos_persona(rol):
    return {
        'nombre': 'Nueva', 'apellido': 'Persona', 'dni': '40111222',
        'fecha_nacimiento': '2001-02-03', 'email': 'nueva@ejemplo.test', 'rol': rol.id,
    }


# --- ejecutar_en_segundo_plano ---

@pytest.mark.django_db(transaction=True)
def test_no_corre_hasta_confirmar_la_transaccion():
    tarea = mock.Mock()

    with transaction.atomic():
        ejecutar_en_segundo_plano(tarea, descripcion='prueba')
        tarea.assert_not_called()

    tarea.assert_called_once()


@pytest.mark.django_db(transaction=True)
def test_si_la_transaccion_se_revierte_no_corre():
    tarea = mock.Mock()

    with pytest.raises(RuntimeError):
        with transaction.atomic():
            ejecutar_en_segundo_plano(tarea, descripcion='prueba')
            raise RuntimeError('rollback')

    tarea.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_un_error_se_registra_y_no_llega_al_llamador(caplog):
    def falla():
        raise SMTPException('smtp caído')

    with caplog.at_level(logging.ERROR, logger='integraciones.fondo'):
        ejecutar_en_segundo_plano(falla, descripcion='correo de prueba')

    assert 'correo de prueba' in caplog.text
    assert 'SMTPException' in caplog.text


@pytest.mark.django_db(transaction=True)
def test_al_fallar_recibe_el_error():
    recibido = []

    def falla():
        raise SMTPException('smtp caído')

    ejecutar_en_segundo_plano(falla, descripcion='prueba', al_fallar=recibido.append)

    assert len(recibido) == 1 and isinstance(recibido[0], SMTPException)


@pytest.mark.django_db(transaction=True)
def test_si_al_fallar_tambien_falla_no_llega_al_llamador(caplog):
    def falla():
        raise SMTPException('x')

    def aviso_roto(_):
        raise ValueError('mongo caído')

    with caplog.at_level(logging.ERROR, logger='integraciones.fondo'):
        ejecutar_en_segundo_plano(falla, descripcion='prueba', al_fallar=aviso_roto)

    assert 'prueba' in caplog.text


@pytest.mark.django_db(transaction=True)
def test_en_hilo_el_llamador_no_espera_a_la_tarea(en_hilo):
    liberar, terminada = threading.Event(), threading.Event()

    def lenta():
        liberar.wait(ESPERA_MAXIMA)
        terminada.set()

    inicio = time.monotonic()
    ejecutar_en_segundo_plano(lenta, descripcion='lenta')

    assert time.monotonic() - inicio < 1
    assert not terminada.is_set()
    liberar.set()
    assert terminada.wait(ESPERA_MAXIMA)


# --- alta de persona ---

@pytest.mark.django_db(transaction=True)
def test_alta_de_persona_no_espera_al_smtp(en_hilo, api_as, admin, rol_estudiante):
    liberar, terminado = threading.Event(), threading.Event()

    def smtp_lento(**_):
        liberar.wait(ESPERA_MAXIMA)
        terminado.set()

    with mock.patch('usuario.correos.send_mail', side_effect=smtp_lento):
        inicio = time.monotonic()
        respuesta = api_as(admin).post('/api/personas/', _datos_persona(rol_estudiante), format='json')
        demora = time.monotonic() - inicio

        assert respuesta.status_code == 201
        assert demora < 1
        assert not terminado.is_set()
        liberar.set()
        assert terminado.wait(ESPERA_MAXIMA)


@pytest.mark.django_db
def test_alta_de_persona_envia_las_credenciales_tras_confirmar(
    api_as, admin, rol_estudiante, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        respuesta = api_as(admin).post('/api/personas/', _datos_persona(rol_estudiante), format='json')

    assert respuesta.status_code == 201
    assert [m.to for m in mail.outbox] == [['nueva@ejemplo.test']]
    assert 'Contraseña provisoria' in mail.outbox[0].body


@pytest.mark.django_db
def test_alta_de_persona_no_envia_nada_antes_de_confirmar(api_as, admin, rol_estudiante):
    # Sin ejecutar los on_commit (el test corre dentro de una transacción) no sale ningún correo
    api_as(admin).post('/api/personas/', _datos_persona(rol_estudiante), format='json')

    assert mail.outbox == []


@pytest.mark.django_db(transaction=True)
def test_si_falla_el_correo_la_alta_se_confirma_y_el_administrador_se_entera(
    api_as, admin, rol_estudiante, caplog
):
    with mock.patch('usuario.correos.send_mail', side_effect=SMTPException('smtp caído')):
        with caplog.at_level(logging.ERROR, logger='integraciones.fondo'):
            respuesta = api_as(admin).post('/api/personas/', _datos_persona(rol_estudiante), format='json')

    assert respuesta.status_code == 201
    persona = Persona.objects.get(dni='40111222')
    assert Usuario.objects.filter(persona=persona, debe_cambiar_password=True).exists()
    assert 'credenciales' in caplog.text
    aviso = mongo.obtener_coleccion(mongo.COLECCION_NOTIFICACION).find_one({'usuario_destino_id': admin.pk})
    assert aviso is not None
    assert 'Persona, Nueva' in aviso['mensaje']
    # El aviso nunca lleva la contraseña provisoria ni el correo
    assert 'nueva@ejemplo.test' not in aviso['mensaje']
    assert aviso['alcance'] == 'ADMINISTRADOR'


@pytest.mark.django_db(transaction=True)
def test_aviso_de_fallo_de_correo_solo_lo_ve_el_administrador(api_as, admin, estudiante, rol_estudiante):
    with mock.patch('usuario.correos.send_mail', side_effect=SMTPException('x')):
        api_as(admin).post('/api/personas/', _datos_persona(rol_estudiante), format='json')

    assert api_as(estudiante).get('/api/notificaciones/').json() == []
    assert len(api_as(admin).get('/api/notificaciones/').json()) == 1


# --- recuperación de contraseña ---

@pytest.mark.django_db(transaction=True)
def test_recuperacion_no_espera_al_smtp(en_hilo, cliente_anonimo, estudiante):
    liberar, terminado = threading.Event(), threading.Event()

    def smtp_lento(**_):
        liberar.wait(ESPERA_MAXIMA)
        terminado.set()

    with mock.patch('usuario.correos.send_mail', side_effect=smtp_lento):
        inicio = time.monotonic()
        respuesta = cliente_anonimo.post(
            '/api/auth/solicitar-recuperacion/', {'email': estudiante.persona.email}, format='json'
        )

        assert respuesta.status_code == 200
        assert time.monotonic() - inicio < 1
        assert not terminado.is_set()
        liberar.set()
        assert terminado.wait(ESPERA_MAXIMA)


@pytest.mark.django_db(transaction=True)
def test_recuperacion_responde_igual_si_falla_el_correo(cliente_anonimo, estudiante):
    cuerpo = {'email': estudiante.persona.email}
    desconocido = cliente_anonimo.post('/api/auth/solicitar-recuperacion/', {'email': 'no@existe.test'}, format='json')

    with mock.patch('usuario.correos.send_mail', side_effect=SMTPException('smtp caído')):
        conocido = cliente_anonimo.post('/api/auth/solicitar-recuperacion/', cuerpo, format='json')

    assert (conocido.status_code, conocido.json()) == (desconocido.status_code, desconocido.json())


@pytest.mark.django_db
def test_recuperacion_envia_el_enlace_tras_confirmar(cliente_anonimo, estudiante, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        cliente_anonimo.post('/api/auth/solicitar-recuperacion/', {'email': estudiante.persona.email}, format='json')

    assert len(mail.outbox) == 1
    assert 'restablecer-password?uid=' in mail.outbox[0].body


# --- Discord ---

WEBHOOK = 'https://discord.com/api/webhooks/123/token-secreto'


@pytest.mark.django_db(transaction=True)
def test_discord_no_espera_a_la_respuesta_del_webhook(en_hilo):
    from aula_virtual.notificaciones import enviar_discord

    liberar, terminado = threading.Event(), threading.Event()

    def post_lento(*_, **__):
        liberar.wait(ESPERA_MAXIMA)
        terminado.set()
        return mock.Mock(status_code=204)

    with mock.patch('aula_virtual.notificaciones.requests.post', side_effect=post_lento):
        inicio = time.monotonic()
        enviar_discord(WEBHOOK, 'Titulo')

        assert time.monotonic() - inicio < 1
        assert not terminado.is_set()
        liberar.set()
        assert terminado.wait(ESPERA_MAXIMA)


@pytest.mark.django_db(transaction=True)
def test_discord_que_falla_se_registra_sin_filtrar_el_webhook(caplog):
    import requests

    from aula_virtual.notificaciones import enviar_discord

    error = requests.ConnectionError(f'no se pudo conectar a {WEBHOOK}')
    with mock.patch('aula_virtual.notificaciones.requests.post', side_effect=error):
        with caplog.at_level(logging.ERROR, logger='integraciones.fondo'):
            enviar_discord(WEBHOOK, 'Titulo')

    assert 'Discord' in caplog.text
    assert 'token-secreto' not in caplog.text


@pytest.mark.django_db(transaction=True)
def test_discord_con_respuesta_de_error_se_registra(caplog):
    from aula_virtual.notificaciones import enviar_discord

    with mock.patch('aula_virtual.notificaciones.requests.post', return_value=mock.Mock(status_code=404)):
        with caplog.at_level(logging.ERROR, logger='integraciones.fondo'):
            enviar_discord(WEBHOOK, 'Titulo')

    assert '404' in caplog.text
    assert 'token-secreto' not in caplog.text


@pytest.mark.django_db(transaction=True)
def test_discord_ignora_urls_que_no_son_de_discord():
    from aula_virtual.notificaciones import enviar_discord

    with mock.patch('aula_virtual.notificaciones.requests.post') as post:
        enviar_discord('https://ejemplo.test/hook', 'Titulo')

    post.assert_not_called()

