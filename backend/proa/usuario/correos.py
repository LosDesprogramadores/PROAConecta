import logging
from types import SimpleNamespace

from django.conf import settings
from django.core.mail import send_mail

from integraciones.fondo import ejecutar_en_segundo_plano

logger = logging.getLogger(__name__)


def _enviar(asunto, cuerpo, destinatario):
    send_mail(
        subject=asunto,
        message=cuerpo,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[destinatario],
        fail_silently=False,
    )


def _avisar_fallo_al_administrador(solicitante_pk, nombre_completo):
    # Mongo, no el ORM: corre en el hilo de fondo. El aviso es solo del administrador (alcance interno
    # ADMINISTRADOR: ni estudiantes ni profesores lo ven) y no lleva ni la clave ni el correo
    # services.crear solo lee .pk del autor: alcanza con un sustituto sin ORM
    from notificacion import services

    services.crear(SimpleNamespace(pk=solicitante_pk), {
        'tipo_notificacion_codigo': 'URGENTE',
        'usuario_destino_id': solicitante_pk,
        'alcance': 'ADMINISTRADOR',
        'titulo': 'No se pudo enviar el correo de credenciales',
        'mensaje': (
            f'La cuenta de {nombre_completo} se creó, pero el correo con la contraseña provisoria no salió. '
            'Pedile que use "Olvidé mi contraseña" cuando el correo vuelva a funcionar.'
        ),
    })


def enviar_credenciales(persona, clave_temporal, solicitante=None):
    """Correo de bienvenida con la clave provisoria. El alta no depende de que salga."""
    asunto = 'Bienvenido a PROA Conecta - Credenciales de acceso'
    cuerpo = f"""Hola {persona.nombre},

            Has sido registrado en la plataforma educativa PROA Conecta.

            Tus datos de acceso para iniciar sesión son:
            - DNI (Usuario): {persona.dni}
            - Contraseña provisoria: {clave_temporal}

            Por cuestiones de seguridad, en tu primer ingreso deberás cambiar obligatoriamente esta clave provisoria:
            {getattr(settings, 'FRONTEND_URL', 'http://localhost:4200')}/login

            Saludos cordiales,
            Equipo Directivo PROA Conecta.
            """
    destinatario = persona.email
    nombre_completo = f'{persona.apellido}, {persona.nombre}'
    al_fallar = None
    if solicitante is not None and getattr(solicitante, 'is_authenticated', False):
        # Ningún objeto del ORM ni del request cruza al hilo de fondo: solo el id y textos ya leídos
        solicitante_pk = solicitante.pk

        def al_fallar(_error):
            _avisar_fallo_al_administrador(solicitante_pk, nombre_completo)

    ejecutar_en_segundo_plano(
        lambda: _enviar(asunto, cuerpo, destinatario),
        descripcion=f'correo de credenciales de la persona {persona.pk}',
        al_fallar=al_fallar,
    )


def enviar_recuperacion(usuario, enlace):
    """Correo con el enlace de restablecimiento. La respuesta del endpoint no depende de que salga."""
    nombre = usuario.persona.nombre if usuario.persona else 'Usuario'
    asunto = 'PROA Conecta - Recuperación de contraseña'
    cuerpo = f"""Hola {nombre},

            Recibimos una solicitud para restablecer la contraseña de tu cuenta institucional en PROA Conecta.

            Para crear una nueva clave, ingresá al siguiente enlace:
            {enlace}

            Este enlace es de uso único y tiene validez temporal. Si no solicitaste este cambio, podés desestimar este mensaje.

            Atentamente,
            Equipo PROA Conecta.
            """
    destinatario = usuario.persona.email
    ejecutar_en_segundo_plano(
        lambda: _enviar(asunto, cuerpo, destinatario),
        descripcion=f'correo de recuperación del usuario {usuario.pk}',
    )
