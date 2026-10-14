import logging
from types import SimpleNamespace
from django.conf import settings
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from integraciones.fondo import ejecutar_en_segundo_plano

logger = logging.getLogger(__name__)


def _enviar(asunto, cuerpo, destinatario):
    try:
        configuration = sib_api_v3_sdk.Configuration()
        # Lee la clave API v3 de forma segura desde las settings (cargadas de Render)
        configuration.api_key['api-key'] = getattr(settings, 'BREVO_API_KEY', '')

        api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
        
        remitente_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'entornojob@gmail.com')
        
        send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": destinatario}],
            sender={"name": "PROA Conecta", "email": remitente_email},
            subject=asunto,
            text_content=cuerpo
        )

        api_response = api_instance.send_transac_email(send_smtp_email)
        logger.info(f"Correo enviado exitosamente con Brevo (API): {api_response}")
        
    except ApiException as e:
        logger.error(f"Error al enviar correo con Brevo API: {e}")
        raise e


def _avisar_fallo_al_administrador(solicitante_pk, nombre_completo):
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
        solicitante_pk = solicitante.pk

        def al_fallar(_error):
            _avisar_fallo_al_administrador(solicitante_pk, nombre_completo)

    ejecutar_en_segundo_plano(
        lambda: _enviar(asunto, cuerpo, destinatario),
        descripcion=f'correo de credenciales de la persona {persona.pk}',
        al_fallar=al_fallar,
    )


def enviar_recuperacion(usuario, enlace):
    nombre = usuario.persona.nombre if usuario.persona else 'Usuario'
    asunto = 'PROA Conecta - Recuperación de contraseña'
    cuerpo = f"""Hola {nombre},

Recibimos una solicitud para restablecer la contraseña de tu cuenta institucional en PROA Conecta.

Para crear una nueva clave, ingresá al siguiente enlace:
{enlace}

Este enlace es de uso único y tiene validez temporal. Si no solicitaste este cambio, podés desestimar este mensaje.

Atentamente,
Equipo Proa Conecta.
"""
    destinatario = usuario.persona.email
    ejecutar_en_segundo_plano(
        lambda: _enviar(asunto, cuerpo, destinatario),
        descripcion=f'correo de recuperación del usuario {usuario.pk}',
    )