import pytest
from django.contrib.auth import authenticate
from django.core.management import CommandError, call_command

from academico.models import Inscripcion, Materia
from aula_virtual.models import Actividad, Entrega, Nota, Unidad
from usuario.models import Persona, Rol, Usuario

CLAVE_DEMO = 'Clave-demo-segura-987'


def contar():
    return {
        'roles': Rol.objects.count(),
        'personas': Persona.objects.count(),
        'usuarios': Usuario.objects.count(),
        'materias': Materia.objects.count(),
        'inscripciones': Inscripcion.objects.count(),
        'unidades': Unidad.objects.count(),
        'actividades': Actividad.objects.count(),
        'entregas': Entrega.objects.count(),
        'notas': Nota.objects.count(),
    }


@pytest.fixture(autouse=True)
def debug_activo(settings):
    settings.DEBUG = True


@pytest.fixture
def clave_demo(monkeypatch):
    monkeypatch.setenv('SEED_DEMO_PASSWORD', CLAVE_DEMO)
    return CLAVE_DEMO


@pytest.mark.django_db
def test_seed_demo_crea_el_juego_de_datos(clave_demo):
    call_command('seed_demo', verbosity=0)

    assert Persona.objects.filter(rol__nombre='Administrador').count() == 1
    assert Persona.objects.filter(rol__nombre='Profesor').count() == 2
    assert Persona.objects.filter(rol__nombre='Estudiante').count() == 6
    assert Materia.objects.count() == 2
    assert all(m.profesor_id for m in Materia.objects.all())
    assert Unidad.objects.count() >= 2
    assert Actividad.objects.count() >= 2
    assert Entrega.objects.exists()
    assert Nota.objects.exists()


@pytest.mark.django_db
def test_seed_demo_es_idempotente(clave_demo):
    call_command('seed_demo', verbosity=0)
    primera = contar()

    call_command('seed_demo', verbosity=0)

    assert contar() == primera


@pytest.mark.django_db
def test_seed_demo_notas_dentro_de_la_escala(clave_demo):
    call_command('seed_demo', verbosity=0)

    for nota in Nota.objects.all():
        assert 1 <= nota.calificacion <= 10


@pytest.mark.django_db
def test_admin_de_demo_puede_iniciar_sesion_por_dni(clave_demo):
    call_command('seed_demo', verbosity=0)
    admin = Persona.objects.get(rol__nombre='Administrador')

    usuario = authenticate(dni=admin.dni, password=clave_demo)

    assert usuario is not None
    assert usuario.persona_id == admin.id
    assert usuario.debe_cambiar_password is False


@pytest.mark.django_db
def test_seed_demo_sin_variable_genera_clave_y_la_imprime_una_vez(monkeypatch, capsys):
    monkeypatch.delenv('SEED_DEMO_PASSWORD', raising=False)

    call_command('seed_demo')
    salida = capsys.readouterr().out
    admin = Persona.objects.get(rol__nombre='Administrador')

    clave = [linea.split(':', 1)[1].strip() for linea in salida.splitlines() if 'Contraseña generada' in linea]
    assert len(clave) == 1 and len(clave[0]) >= 16
    assert authenticate(dni=admin.dni, password=clave[0]) is not None


@pytest.mark.django_db
def test_seed_demo_segunda_ejecucion_no_cambia_claves_existentes(monkeypatch, capsys):
    monkeypatch.delenv('SEED_DEMO_PASSWORD', raising=False)
    call_command('seed_demo')
    salida = capsys.readouterr().out
    clave = [l.split(':', 1)[1].strip() for l in salida.splitlines() if 'Contraseña generada' in l][0]

    call_command('seed_demo')
    admin = Persona.objects.get(rol__nombre='Administrador')

    assert authenticate(dni=admin.dni, password=clave) is not None


@pytest.mark.django_db
def test_seed_demo_se_niega_a_correr_sin_debug(settings, clave_demo):
    settings.DEBUG = False

    with pytest.raises(CommandError, match='--force'):
        call_command('seed_demo', verbosity=0)

    assert Persona.objects.count() == 0


@pytest.mark.django_db
def test_seed_demo_con_force_corre_sin_debug(settings, clave_demo):
    settings.DEBUG = False

    call_command('seed_demo', force=True, verbosity=0)

    assert Persona.objects.count() == 9


@pytest.mark.django_db
@pytest.mark.parametrize('valor', ['', 'corta'])
def test_seed_demo_rechaza_clave_vacia_o_corta(monkeypatch, valor):
    monkeypatch.setenv('SEED_DEMO_PASSWORD', valor)

    with pytest.raises(CommandError, match='SEED_DEMO_PASSWORD'):
        call_command('seed_demo', verbosity=0)

    assert Persona.objects.count() == 0
