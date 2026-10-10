"""Seguimiento de entregas de todos los inscriptos de una actividad (TSK191, #321)."""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from aula_virtual.models import Actividad, Entrega, Nota
from usuario.tests.factories import PersonaFactory, UsuarioFactory

pytestmark = pytest.mark.django_db

Estado = Inscripcion.EstadoInscripcion


@pytest.fixture
def materia(profesor):
    return MateriaFactory(profesor=profesor.persona)


@pytest.fixture
def actividad(materia):
    return Actividad.objects.create(
        materia=materia, titulo='TP 1', fecha_limite=timezone.now() + timedelta(days=3)
    )


@pytest.fixture
def actividad_vencida(materia):
    return Actividad.objects.create(
        materia=materia, titulo='TP vencido', fecha_limite=timezone.now() - timedelta(days=3)
    )


def _alumno(rol_estudiante, materia, estado=Estado.CURSANDO, **persona):
    alumno = PersonaFactory(rol=rol_estudiante, **persona)
    InscripcionFactory(materia=materia, estudiante=alumno, estado=estado)
    return alumno


def _seguimiento(api_as, usuario, actividad):
    return api_as(usuario).get(f'/api/actividades/{actividad.pk}/seguimiento/')


def _fila(respuesta, alumno):
    return next(f for f in respuesta.json()['estudiantes'] if f['estudiante_id'] == alumno.pk)


def test_devuelve_encabezado_resumen_y_una_fila_por_inscripto(api_as, profesor, materia, actividad, rol_estudiante):
    alumno = _alumno(rol_estudiante, materia, apellido='Zeta', nombre='Ana')

    respuesta = _seguimiento(api_as, profesor, actividad)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo['actividad']['id'] == actividad.pk
    assert cuerpo['actividad']['titulo'] == 'TP 1'
    assert cuerpo['actividad']['fecha_limite'] is not None
    assert cuerpo['materia'] == {'id': materia.pk, 'titulo': materia.titulo}
    assert cuerpo['resumen'] == {
        'PENDIENTE': 1, 'ENTREGADO': 0, 'FUERA_DE_TERMINO': 0, 'CORREGIDO': 0, 'NO_ENTREGADO': 0,
    }
    assert cuerpo['estudiantes'] == [{
        'estudiante_id': alumno.pk,
        'apellido': 'Zeta',
        'nombre': 'Ana',
        'dni': alumno.dni,
        'estado': 'PENDIENTE',
        'entrega_id': None,
        'fecha_entrega': None,
        'nota': None,
    }]


def test_los_cinco_estados(api_as, profesor, materia, actividad, actividad_vencida, rol_estudiante):
    pendiente = _alumno(rol_estudiante, materia)
    entregado = _alumno(rol_estudiante, materia)
    tarde = _alumno(rol_estudiante, materia)
    corregido = _alumno(rol_estudiante, materia)
    Entrega.objects.create(actividad=actividad, estudiante=entregado, contenido_texto='x')
    Entrega.objects.create(actividad=actividad, estudiante=tarde, contenido_texto='x', fuera_de_termino=True)
    entrega = Entrega.objects.create(
        actividad=actividad, estudiante=corregido, contenido_texto='x', estado=Entrega.EstadoEntrega.CORREGIDO
    )
    Nota.objects.create(entrega=entrega, profesor=profesor.persona, calificacion='8.5', descripcion='Bien')

    r = _seguimiento(api_as, profesor, actividad)
    assert _fila(r, pendiente)['estado'] == 'PENDIENTE'
    assert _fila(r, entregado)['estado'] == 'ENTREGADO'
    assert _fila(r, tarde)['estado'] == 'FUERA_DE_TERMINO'
    assert _fila(r, corregido)['estado'] == 'CORREGIDO'
    assert r.json()['resumen'] == {
        'PENDIENTE': 1, 'ENTREGADO': 1, 'FUERA_DE_TERMINO': 1, 'CORREGIDO': 1, 'NO_ENTREGADO': 0,
    }

    # Sin entrega y con el plazo vencido
    r = _seguimiento(api_as, profesor, actividad_vencida)
    assert {f['estado'] for f in r.json()['estudiantes']} == {'NO_ENTREGADO'}
    assert r.json()['resumen']['NO_ENTREGADO'] == 4


def test_la_fila_trae_entrega_fecha_y_nota(api_as, profesor, materia, actividad, rol_estudiante):
    alumno = _alumno(rol_estudiante, materia)
    entrega = Entrega.objects.create(
        actividad=actividad, estudiante=alumno, contenido_texto='x', estado=Entrega.EstadoEntrega.CORREGIDO
    )
    Nota.objects.create(entrega=entrega, profesor=profesor.persona, calificacion='7', descripcion='Ok')

    fila = _fila(_seguimiento(api_as, profesor, actividad), alumno)

    assert fila['entrega_id'] == entrega.pk
    assert fila['fecha_entrega'] is not None
    assert fila['nota'] == {'calificacion': '7.00', 'descripcion': 'Ok'}


def test_actividad_sin_fecha_limite_nunca_es_no_entregado(api_as, profesor, materia, rol_estudiante):
    actividad = Actividad.objects.create(materia=materia, titulo='Sin plazo')
    alumno = _alumno(rol_estudiante, materia)

    assert _fila(_seguimiento(api_as, profesor, actividad), alumno)['estado'] == 'PENDIENTE'


def test_la_entrega_dada_de_baja_no_cuenta(api_as, profesor, materia, actividad, rol_estudiante):
    alumno = _alumno(rol_estudiante, materia)
    Entrega.objects.create(actividad=actividad, estudiante=alumno, contenido_texto='x', fecha_baja=timezone.now())

    fila = _fila(_seguimiento(api_as, profesor, actividad), alumno)

    assert fila['estado'] == 'PENDIENTE' and fila['entrega_id'] is None


def test_excluye_baja_y_persona_dada_de_baja_e_incluye_libre(api_as, profesor, materia, actividad, rol_estudiante):
    cursando = _alumno(rol_estudiante, materia)
    libre = _alumno(rol_estudiante, materia, estado=Estado.LIBRE)
    en_baja = _alumno(rol_estudiante, materia, estado=Estado.BAJA)
    persona_baja = _alumno(rol_estudiante, materia, fecha_baja=timezone.now())

    ids = {f['estudiante_id'] for f in _seguimiento(api_as, profesor, actividad).json()['estudiantes']}

    assert ids == {cursando.pk, libre.pk}
    assert en_baja.pk not in ids and persona_baja.pk not in ids


def test_no_incluye_alumnos_de_otra_materia(api_as, profesor, materia, actividad, rol_estudiante):
    ajeno = _alumno(rol_estudiante, MateriaFactory(profesor=profesor.persona))

    ids = {f['estudiante_id'] for f in _seguimiento(api_as, profesor, actividad).json()['estudiantes']}

    assert ajeno.pk not in ids


def test_orden_por_apellido_y_nombre(api_as, profesor, materia, actividad, rol_estudiante):
    _alumno(rol_estudiante, materia, apellido='Perez', nombre='Zoe')
    _alumno(rol_estudiante, materia, apellido='Acosta', nombre='Luis')
    _alumno(rol_estudiante, materia, apellido='Perez', nombre='Ana')

    filas = _seguimiento(api_as, profesor, actividad).json()['estudiantes']

    assert [(f['apellido'], f['nombre']) for f in filas] == [('Acosta', 'Luis'), ('Perez', 'Ana'), ('Perez', 'Zoe')]


def test_el_admin_puede_verlo(api_as, admin, actividad):
    assert _seguimiento(api_as, admin, actividad).status_code == 200


def test_profesor_que_no_es_titular_recibe_404(api_as, rol_profesor, actividad):
    ajeno = UsuarioFactory(persona__rol=rol_profesor)

    assert _seguimiento(api_as, ajeno, actividad).status_code == 404


def test_estudiante_inscripto_recibe_403(api_as, estudiante, materia, actividad):
    InscripcionFactory(materia=materia, estudiante=estudiante.persona)

    assert _seguimiento(api_as, estudiante, actividad).status_code == 403


def test_estudiante_ajeno_recibe_404(api_as, estudiante, actividad):
    assert _seguimiento(api_as, estudiante, actividad).status_code == 404


def test_anonimo_recibe_401(cliente_anonimo, actividad):
    assert cliente_anonimo.get(f'/api/actividades/{actividad.pk}/seguimiento/').status_code == 401


def test_actividad_inexistente_o_dada_de_baja_es_404(api_as, profesor, actividad):
    assert api_as(profesor).get('/api/actividades/99999/seguimiento/').status_code == 404
    actividad.soft_delete()
    assert _seguimiento(api_as, profesor, actividad).status_code == 404


def test_solo_lectura(api_as, profesor, actividad):
    assert api_as(profesor).post(f'/api/actividades/{actividad.pk}/seguimiento/').status_code == 405


@pytest.mark.parametrize('cantidad', [1, 10])
def test_presupuesto_de_consultas_constante(
    api_as, profesor, materia, actividad, rol_estudiante, cantidad, django_assert_max_num_queries
):
    for i in range(cantidad):
        alumno = _alumno(rol_estudiante, materia)
        entrega = Entrega.objects.create(
            actividad=actividad, estudiante=alumno, contenido_texto='x', estado=Entrega.EstadoEntrega.CORREGIDO
        )
        Nota.objects.create(entrega=entrega, profesor=profesor.persona, calificacion=8)
    _alumno(rol_estudiante, materia)

    with django_assert_max_num_queries(8):
        respuesta = _seguimiento(api_as, profesor, actividad)

    assert len(respuesta.json()['estudiantes']) == cantidad + 1


# --- Casos borde de _estado_de_seguimiento / plazo (tiempo fijado con mock de timezone.now) ---

AHORA = timezone.now().replace(microsecond=0)


@pytest.mark.parametrize(
    'limite, estado_entrega, fuera_de_termino, con_nota, esperado',
    [
        # Plazo: el vencimiento es estricto (now > limite)
        (timedelta(0), None, False, False, 'PENDIENTE'),
        (-timedelta(seconds=1), None, False, False, 'NO_ENTREGADO'),
        (timedelta(seconds=1), None, False, False, 'PENDIENTE'),
        (None, None, False, False, 'PENDIENTE'),
        # Borrador: no cuenta como entrega
        (-timedelta(days=1), Entrega.EstadoEntrega.BORRADOR, False, False, 'NO_ENTREGADO'),
        (timedelta(days=1), Entrega.EstadoEntrega.BORRADOR, False, False, 'PENDIENTE'),
        # Marcada sin entregar
        (-timedelta(days=1), Entrega.EstadoEntrega.NO_ENTREGADO, False, False, 'NO_ENTREGADO'),
        (timedelta(days=1), Entrega.EstadoEntrega.NO_ENTREGADO, False, False, 'PENDIENTE'),
        # Con nota prevalece aunque el estado no sea CORREGIDO
        (timedelta(days=1), Entrega.EstadoEntrega.ENTREGADO, False, True, 'CORREGIDO'),
        (timedelta(days=1), Entrega.EstadoEntrega.CORREGIDO, False, False, 'CORREGIDO'),
        (timedelta(days=1), Entrega.EstadoEntrega.ENTREGADO, False, False, 'ENTREGADO'),
        (-timedelta(days=1), Entrega.EstadoEntrega.ENTREGADO, True, False, 'FUERA_DE_TERMINO'),
    ],
)
def test_estado_de_seguimiento_casos_borde(
    profesor, materia, rol_estudiante, limite, estado_entrega, fuera_de_termino, con_nota, esperado
):
    from aula_virtual.services import seguimiento_de_actividad

    actividad = Actividad.objects.create(
        materia=materia, titulo='TP borde', fecha_limite=None if limite is None else AHORA + limite
    )
    alumno = _alumno(rol_estudiante, materia)
    if estado_entrega is not None:
        entrega = Entrega.objects.create(
            actividad=actividad, estudiante=alumno, contenido_texto='x',
            estado=estado_entrega, fuera_de_termino=fuera_de_termino,
        )
        if con_nota:
            Nota.objects.create(entrega=entrega, calificacion=7)

    with patch('aula_virtual.services.timezone.now', return_value=AHORA):
        resultado = seguimiento_de_actividad(profesor, actividad)

    (fila,) = resultado['estudiantes']
    assert fila['estado'] == esperado
    assert resultado['resumen'][esperado] == 1
