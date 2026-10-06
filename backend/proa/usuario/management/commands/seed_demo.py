import os
import secrets
from datetime import date, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from academico.models import Inscripcion, Materia
from aula_virtual.models import Actividad, Entrega, Unidad
from aula_virtual.services import calificar_o_rectificar_estudiante
from usuario.models import Persona, Rol, Usuario

VARIABLE_CLAVE = 'SEED_DEMO_PASSWORD'
LARGO_MINIMO_CLAVE = 8
DOMINIO_EMAIL = 'proa-demo.test'

# (dni, nombre, apellido); el rol lo da la lista
ADMINISTRADORES = [('10000001', 'Ana', 'Administradora')]
PROFESORES = [
    ('20000001', 'Pablo', 'Profesor'),
    ('20000002', 'Paula', 'Profesora'),
]
ESTUDIANTES = [
    ('30000001', 'Elena', 'Estudiante'),
    ('30000002', 'Esteban', 'Estudiante'),
    ('30000003', 'Emma', 'Estudiante'),
    ('30000004', 'Emilio', 'Estudiante'),
    ('30000005', 'Eva', 'Estudiante'),
    ('30000006', 'Ezequiel', 'Estudiante'),
]

# Cada materia: titulo, indice del profesor, indices de estudiantes inscriptos, unidades
MATERIAS = [
    {
        'titulo': 'Matemática',
        'profesor': 0,
        'estudiantes': [0, 1, 2, 3],
        'unidades': ['Números y operaciones', 'Geometría básica'],
    },
    {
        'titulo': 'Lengua y Literatura',
        'profesor': 1,
        'estudiantes': [2, 3, 4, 5],
        'unidades': ['Comprensión lectora', 'Géneros narrativos'],
    },
]
CURSO = '1ro A'

# Notas de la primera actividad de cada materia, rotadas por estudiante
NOTAS = ['10.00', '8.50', '7.00', '6.00']


class Command(BaseCommand):
    help = (
        'Carga datos de demostración (1 administrador, 2 profesores, 6 estudiantes, 2 materias '
        'con unidades, actividades, entregas y notas). Es idempotente y también sirve para crear '
        f'el primer administrador. Las contraseñas salen de la variable de entorno {VARIABLE_CLAVE}; '
        'si falta, se genera una al azar y se muestra una sola vez.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Permite ejecutar el comando aunque DEBUG esté desactivado (no recomendado en producción).',
        )
        parser.add_argument(
            '--actualizar-claves',
            action='store_true',
            help=(
                f'Reaplica la contraseña de {VARIABLE_CLAVE} a las cuentas de demostración que ya existen '
                '(solo los DNI de demo). Exige que la variable esté definida.'
            ),
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options['force']:
            raise CommandError(
                'seed_demo carga datos de demostración y solo corre con DEBUG activado. '
                'Si de verdad querés ejecutarlo en este entorno, agregá --force.'
            )
        self.actualizar_claves = options['actualizar_claves']
        clave, generada = self._obtener_clave()
        self.creados = 0
        self.actualizados = 0

        with transaction.atomic():
            roles = self._roles()
            admins = [self._persona_con_usuario(d, roles['Administrador'], clave) for d in ADMINISTRADORES]
            profesores = [self._persona_con_usuario(d, roles['Profesor'], clave) for d in PROFESORES]
            estudiantes = [self._persona_con_usuario(d, roles['Estudiante'], clave) for d in ESTUDIANTES]
            for definicion in MATERIAS:
                self._materia(definicion, profesores, estudiantes)

        self.stdout.write(self.style.SUCCESS('Datos de demostración listos.'))
        self.stdout.write(f'Administrador: DNI {admins[0][0].dni}')
        self.stdout.write('Profesores: DNI ' + ', '.join(p.dni for p, _ in profesores))
        self.stdout.write('Estudiantes: DNI ' + ', '.join(e.dni for e, _ in estudiantes))
        self.stdout.write(f'Cuentas creadas: {self.creados}')
        self.stdout.write(f'Contraseñas actualizadas: {self.actualizados}')
        if generada and self.creados:
            self.stdout.write(self.style.WARNING(f'Contraseña generada: {clave}'))
            self.stdout.write('Guardala ahora: no se vuelve a mostrar.')
        elif self.creados == 0 and not self.actualizar_claves:
            self.stdout.write('Los usuarios ya existían: no se modificaron sus contraseñas.')

    def _obtener_clave(self):
        clave = os.environ.get(VARIABLE_CLAVE)
        # Nunca se pisa una clave existente con una al azar: la anterior se perdería
        if self.actualizar_claves and not clave:
            raise CommandError(
                f'--actualizar-claves requiere definir {VARIABLE_CLAVE} con al menos '
                f'{LARGO_MINIMO_CLAVE} caracteres. No se genera una clave al azar para cuentas existentes.'
            )
        if clave is not None:
            if len(clave) < LARGO_MINIMO_CLAVE:
                raise CommandError(
                    f'{VARIABLE_CLAVE} no puede estar vacía y debe tener al menos {LARGO_MINIMO_CLAVE} caracteres.'
                )
            return clave, False
        return secrets.token_urlsafe(16), True

    def _roles(self):
        roles = {r.nombre: r for r in Rol.objects.filter(nombre__in=['Administrador', 'Profesor', 'Estudiante'])}
        if len(roles) != 3:
            raise CommandError('Faltan los roles iniciales. Ejecutá primero "python manage.py migrate".')
        return roles

    def _persona_con_usuario(self, datos, rol, clave):
        dni, nombre, apellido = datos
        persona, _ = Persona.objects.get_or_create(
            dni=dni,
            defaults={
                'rol': rol,
                'nombre': nombre,
                'apellido': apellido,
                'fecha_nacimiento': date(1990, 1, 1) if rol.nombre != 'Estudiante' else date(2010, 1, 1),
                'email': f'{dni}@{DOMINIO_EMAIL}',
            },
        )
        usuario = Usuario.objects.filter(persona=persona).first()
        if usuario is None:
            usuario = Usuario(
                persona=persona,
                username=dni,
                nombre_usuario=dni,
                email=persona.email,
                first_name=nombre,
                last_name=apellido,
                debe_cambiar_password=False,
            )
            usuario.set_password(clave)
            usuario.save()
            self.creados += 1
        elif self.actualizar_claves:
            # Solo se pisa la clave si la persona es de demo; si no, es una persona real con ese DNI
            if persona.email == f'{dni}@{DOMINIO_EMAIL}':
                usuario.set_password(clave)
                usuario.debe_cambiar_password = False
                usuario.save(update_fields=['password', 'debe_cambiar_password'])
                self.actualizados += 1
            else:
                self.stdout.write(
                    self.style.WARNING(f'Advertencia: el DNI {dni} no es una cuenta de demo; no se tocó su contraseña.')
                )
        return persona, usuario

    def _materia(self, definicion, profesores, estudiantes):
        profesor, profesor_usuario = profesores[definicion['profesor']]
        materia, _ = Materia.objects.get_or_create(
            titulo=definicion['titulo'],
            curso=CURSO,
            anio=timezone.now().year,
            defaults={'descripcion': 'Materia de demostración', 'profesor': profesor},
        )

        inscriptos = []
        for indice in definicion['estudiantes']:
            persona, _ = estudiantes[indice]
            Inscripcion.objects.get_or_create(materia=materia, estudiante=persona)
            inscriptos.append(persona)

        unidades = []
        for orden, titulo in enumerate(definicion['unidades'], start=1):
            unidad, _ = Unidad.objects.get_or_create(materia=materia, titulo=titulo, defaults={'orden': orden})
            unidades.append(unidad)

        limite = timezone.now() + timedelta(days=14)
        actividades = []
        for unidad in unidades:
            actividad, _ = Actividad.objects.get_or_create(
                materia=materia,
                titulo=f'Trabajo práctico: {unidad.titulo}',
                defaults={'unidad': unidad, 'descripcion': 'Actividad de demostración', 'fecha_limite': limite},
            )
            actividades.append(actividad)

        # Solo la primera actividad tiene entregas y notas; la segunda queda pendiente
        primera = actividades[0]
        for posicion, persona in enumerate(inscriptos):
            Entrega.objects.get_or_create(
                actividad=primera,
                estudiante=persona,
                fecha_baja__isnull=True,
                defaults={'contenido_texto': 'Entrega de demostración', 'estado': Entrega.EstadoEntrega.ENTREGADO},
            )
            # El servicio valida la escala 1.00-10.00 y es idempotente (update_or_create)
            calificar_o_rectificar_estudiante(
                profesor_usuario,
                primera.id,
                persona.id,
                NOTAS[posicion % len(NOTAS)],
                'Nota de demostración',
            )
