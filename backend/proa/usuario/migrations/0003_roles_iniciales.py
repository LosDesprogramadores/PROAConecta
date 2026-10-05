from django.core.management.color import no_style
from django.db import migrations

# Los ids son fijos porque aula_virtual/helpers.py todavía detecta al administrador con
# rol_id == 1. Mientras los permisos no se resuelvan por nombre (spec 007/T008), el orden
# Administrador, Profesor, Estudiante es parte del contrato del esquema.
ROLES_INICIALES = (
    (1, 'Administrador', 'Gestiona personas, materias y roles'),
    (2, 'Profesor', 'Dicta materias y califica entregas'),
    (3, 'Estudiante', 'Cursa materias y realiza entregas'),
)


def crear_roles(apps, schema_editor):
    Rol = apps.get_model('usuario', 'Rol')

    for id_rol, nombre, descripcion in ROLES_INICIALES:
        # Idempotente: si el rol ya existe (base compartida o segunda ejecución) no se toca
        if Rol.objects.filter(nombre=nombre).exists():
            continue
        if Rol.objects.filter(pk=id_rol).exists():
            raise RuntimeError(
                f'El id {id_rol} ya pertenece a otro rol y se necesita para "{nombre}". '
                'Revisá la tabla usuario_rol antes de migrar.'
            )
        Rol.objects.create(id=id_rol, nombre=nombre, descripcion=descripcion)

    # En PostgreSQL insertar ids explícitos no avanza la secuencia: sin esto, el próximo
    # Rol.objects.create() chocaría con el id 1. En SQLite la lista de sentencias es vacía.
    for sentencia in schema_editor.connection.ops.sequence_reset_sql(no_style(), [Rol]):
        schema_editor.execute(sentencia)


class Migration(migrations.Migration):

    dependencies = [
        ('usuario', '0002_usuario_debe_cambiar_password'),
    ]

    operations = [
        # Reversa vacía: los roles pueden tener personas asociadas, no se borran al revertir
        migrations.RunPython(crear_roles, migrations.RunPython.noop),
    ]
