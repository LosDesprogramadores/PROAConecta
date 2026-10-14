import logging
from types import SimpleNamespace

from django.conf import settings
import resend

logger = logging.getLogger(__name__)

# Configurar la API key de Resend
resend.api_key = getattr(settings, 'RESEND_API_KEY', '')


def _enviar(asunto, cuerpo, destinatario):
    try:
        remitente = getattr(settings, 'DEFAULT_FROM_EMAIL', 'PROA Conecta <onboarding@resend.dev>')
        
        params = {
            "from": remitente,
            "to": [destinatario],
            "subject": asunto,
            "text": cuerpo,
        }
        
        response = resend.Emails.send(params)
        logger.info(f"Correo enviado exitosamente con Resend: {response}")
    except Exception as e:
        logger.error(f"Error al enviar correo con Resend: {e}")
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
Equipo PROA Conecta.
"""
    destinatario = usuario.persona.email
    ejecutar_en_segundo_plano(
        lambda: _enviar(asunto, cuerpo, destinatario),
        descripcion=f'correo de recuperación del usuario {usuario.pk}',
    )