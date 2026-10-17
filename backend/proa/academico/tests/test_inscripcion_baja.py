import pytest

from academico.models import Inscripcion
from academico.selectors import materias_con_acceso
from academico.tests.factories import InscripcionFactory, MateriaFactory
from core.roles import tiene_inscripcion_activa
from aula_virtual.models import Actividad, Entrega, Material, Nota, Unidad

Estado = Inscripcion.EstadoInscripcion
ESTADOS_CON_ACCESO = [Estado.CURSANDO, Estado.REGULAR, Estado.PROMOCIONADO, Estado.LIBRE]


@pytest.fixture
def materia(materia_con_inscripcion):
    return materia_con_inscripcion


@pytest.fixture
def contenido(materia):
    unidad = Unidad.objects.create(materia=materia, titulo='Unidad 1')
    Material.objects.create(materia=materia, unidad=unidad, titulo='Apunte', tipo='ENLACE', enlace='https://ejemplo.test')
    actividad = Actividad.objects.create(
        materia=materia, unidad=unidad, titulo='TP 1', estado=Actividad.EstadoActividad.PUBLICADA
    )
    return {'unidad': unidad, 'actividad': actividad}


def poner_estado(materia, estudiante, estado):
    Inscripcion.objects.filter(materia=materia, estudiante=estudiante.persona).update(estado=estado)


def ids(respuesta):
    datos = respuesta.data['results'] if isinstance(respuesta.data, dict) and 'results' in respuesta.data else respuesta.data
    return [fila['id'] for fila in datos]


# --- Selectores ---------------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.parametrize('estado', ESTADOS_CON_ACCESO)
def test_tiene_inscripcion_activa_cuenta_todos_los_estados_salvo_baja(materia, estudiante, estado):
    poner_estado(materia, estudiante, estado)

    assert tiene_inscripcion_activa(estudiante.persona, materia) is True


@pytest.mark.django_db
def test_tiene_inscripcion_activa_es_falso_con_baja_sin_inscripcion_o_sin_persona(materia, estudiante, rol_estudiante):
    from usuario.tests.factories import PersonaFactory

    poner_estado(materia, estudiante, Estado.BAJA)

    assert tiene_inscripcion_activa(estudiante.persona, materia) is False
    assert tiene_inscripcion_activa(PersonaFactory(rol=rol_estudiante), materia) is False
    assert tiene_inscripcion_activa(None, materia) is False


@pytest.mark.django_db
def test_materias_con_acceso_incluye_libre_y_excluye_baja(estudiante):
    cursando = InscripcionFactory(estudiante=estudiante.persona, estado=Estado.CURSANDO).materia
    libre = InscripcionFactory(estudiante=estudiante.persona, estado=Estado.LIBRE).materia
    baja = InscripcionFactory(estudiante=estudiante.persona, estado=Estado.BAJA).materia
    ajena = MateriaFactory()

    resultado = set(materias_con_acceso(estudiante.persona).values_list('id', flat=True))

    assert resultado == {cursando.id, libre.id}
    assert baja.id not in resultado and ajena.id not in resultado


# --- Acceso a la materia desde el aula virtual --------------------------------------------------

@pytest.mark.django_db
@pytest.mark.parametrize('url', ['/api/unidades/', '/api/materiales/', '/api/actividades/'])
@pytest.mark.parametrize('estado', ESTADOS_CON_ACCESO)
def test_estudiante_con_inscripcion_no_baja_ve_el_contenido_de_la_materia(api_as, estudiante, materia, contenido, url, estado):
    # LIBRE sigue siendo parte de la materia: ve lo mismo que un alumno CURSANDO
    poner_estado(materia, estudiante, estado)

    respuesta = api_as(estudiante).get(url, {'materia': materia.id})

    assert respuesta.status_code == 200
    assert len(ids(respuesta)) == 1


@pytest.mark.django_db
@pytest.mark.parametrize('url', ['/api/unidades/', '/api/materiales/', '/api/actividades/'])
def test_estudiante_en_baja_no_ve_unidades_materiales_ni_actividades(api_as, estudiante, materia, contenido, url):
    poner_estado(materia, estudiante, Estado.BAJA)

    respuesta = api_as(estudiante).get(url, {'materia': materia.id})

    assert respuesta.status_code == 200
    assert ids(respuesta) == []


@pytest.mark.django_db
def test_estudiante_en_baja_no_ve_sus_entregas_de_la_materia_y_en_libre_si(api_as, estudiante, materia, contenido):
    entrega = Entrega.objects.create(actividad=contenido['actividad'], estudiante=estudiante.persona, contenido_texto='TP')

    poner_estado(materia, estudiante, Estado.LIBRE)
    assert ids(api_as(estudiante).get('/api/entregas/')) == [entrega.id]

    poner_estado(materia, estudiante, Estado.BAJA)
    assert ids(api_as(estudiante).get('/api/entregas/')) == []


@pytest.mark.django_db
def test_estudiante_en_baja_no_puede_entregar_y_en_libre_si(api_as, estudiante, materia, contenido):
    datos = {'actividad': contenido['actividad'].id, 'contenido_texto': 'Mi entrega'}

    poner_estado(materia, estudiante, Estado.BAJA)
    rechazada = api_as(estudiante).post('/api/entregas/', datos, format='json')
    assert rechazada.status_code == 403
    assert Entrega.objects.count() == 0

    poner_estado(materia, estudiante, Estado.LIBRE)
    aceptada = api_as(estudiante).post('/api/entregas/', datos, format='json')
    assert aceptada.status_code == 201


@pytest.mark.django_db
def test_mi_rendimiento_respeta_el_estado_de_la_inscripcion(api_as, estudiante, materia):
    url = f'/api/materias/{materia.id}/mi-rendimiento/'

    poner_estado(materia, estudiante, Estado.LIBRE)
    assert api_as(estudiante).get(url).status_code == 200

    poner_estado(materia, estudiante, Estado.BAJA)
    assert api_as(estudiante).get(url).status_code == 403


@pytest.mark.django_db
def test_profesor_no_puede_calificar_a_un_estudiante_en_baja(api_as, profesor, estudiante, materia, contenido):
    url = f'/api/actividades/{contenido["actividad"].id}/calificar-estudiante/'
    datos = {'estudiante_id': estudiante.persona.id, 'calificacion': 8}

    poner_estado(materia, estudiante, Estado.BAJA)
    rechazada = api_as(profesor).post(url, datos, format='json')
    assert rechazada.status_code == 400
    assert 'estudiante_id' in rechazada.data

    poner_estado(materia, estudiante, Estado.LIBRE)
    assert api_as(profesor).post(url, datos, format='json').status_code == 200


@pytest.mark.django_db
def test_rendimiento_del_curso_lista_a_los_libres_y_no_a_los_dados_de_baja(api_as, profesor, estudiante, materia, rol_estudiante):
    en_baja = InscripcionFactory(materia=materia, estado=Estado.BAJA).estudiante
    libre = InscripcionFactory(materia=materia, estado=Estado.LIBRE).estudiante

    respuesta = api_as(profesor).get(f'/api/materias/{materia.id}/rendimiento-curso/')

    listados = {a['estudiante_id'] for a in respuesta.data['alumnos']}
    assert libre.id in listados and estudiante.persona.id in listados
    assert en_baja.id not in listados
    assert respuesta.data['total_alumnos'] == 2


# --- Desinscribir e inscribir ------------------------------------------------------------------

@pytest.mark.django_db
def test_desinscribir_marca_baja_y_no_borra_la_fila(api_as, admin, estudiante, materia):
    inscripcion = Inscripcion.objects.get(materia=materia, estudiante=estudiante.persona)

    respuesta = api_as(admin).post(
        '/api/inscripciones/desinscribir/',
        {'estudiante_id': estudiante.persona.id, 'materia_id': materia.id},
        format='json',
    )

    assert respuesta.status_code == 200
    inscripcion.refresh_from_db()
    assert inscripcion.estado == Estado.BAJA


@pytest.mark.django_db
def test_desinscribir_quita_el_acceso_del_estudiante(api_as, admin, estudiante, materia, contenido):
    assert len(ids(api_as(estudiante).get('/api/unidades/', {'materia': materia.id}))) == 1

    api_as(admin).post(
        '/api/inscripciones/desinscribir/',
        {'estudiante_id': estudiante.persona.id, 'materia_id': materia.id},
        format='json',
    )

    assert ids(api_as(estudiante).get('/api/unidades/', {'materia': materia.id})) == []


@pytest.mark.django_db
def test_desinscribir_dos_veces_devuelve_404_con_detail(api_as, admin, estudiante, materia):
    datos = {'estudiante_id': estudiante.persona.id, 'materia_id': materia.id}
    api_as(admin).post('/api/inscripciones/desinscribir/', datos, format='json')

    respuesta = api_as(admin).post('/api/inscripciones/desinscribir/', datos, format='json')

    assert respuesta.status_code == 404
    assert 'detail' in respuesta.data


@pytest.mark.django_db
def test_desinscribir_con_notas_cargadas_devuelve_400_y_no_cambia_el_estado(api_as, admin, profesor, estudiante, materia, contenido):
    entrega = Entrega.objects.create(actividad=contenido['actividad'], estudiante=estudiante.persona, contenido_texto='TP')
    Nota.objects.create(entrega=entrega, profesor=profesor.persona, calificacion=8)

    respuesta = api_as(admin).post(
        '/api/inscripciones/desinscribir/',
        {'estudiante_id': estudiante.persona.id, 'materia_id': materia.id},
        format='json',
    )

    assert respuesta.status_code == 400
    assert 'notas' in respuesta.data['detail']
    assert Inscripcion.objects.get(materia=materia, estudiante=estudiante.persona).estado == Estado.CURSANDO


@pytest.mark.django_db
def test_inscribir_reactiva_la_misma_fila_dada_de_baja(api_as, admin, estudiante, materia):
    inscripcion = Inscripcion.objects.get(materia=materia, estudiante=estudiante.persona)
    poner_estado(materia, estudiante, Estado.BAJA)

    respuesta = api_as(admin).post(
        '/api/inscripciones/inscribir/',
        {'estudiante_id': estudiante.persona.id, 'materia_ids': [materia.id]},
        format='json',
    )

    assert respuesta.status_code == 201
    assert respuesta.data['cantidad'] == 1
    assert Inscripcion.objects.filter(materia=materia, estudiante=estudiante.persona).count() == 1
    inscripcion.refresh_from_db()
    assert inscripcion.estado == Estado.CURSANDO


@pytest.mark.django_db
def test_inscribir_no_pisa_el_estado_de_una_inscripcion_que_no_esta_en_baja(api_as, admin, estudiante, materia):
    poner_estado(materia, estudiante, Estado.LIBRE)

    respuesta = api_as(admin).post(
        '/api/inscripciones/inscribir/',
        {'estudiante_id': estudiante.persona.id, 'materia_ids': [materia.id]},
        format='json',
    )

    assert respuesta.status_code == 201
    assert respuesta.data['cantidad'] == 0
    assert Inscripcion.objects.get(materia=materia, estudiante=estudiante.persona).estado == Estado.LIBRE


@pytest.mark.django_db
def test_materia_con_baja_figura_como_disponible_para_volver_a_inscribir(api_as, admin, estudiante, materia):
    en_baja = InscripcionFactory(estudiante=estudiante.persona, estado=Estado.BAJA).materia

    respuesta = api_as(admin).get('/api/materias/', {'disponibles_estudiante': estudiante.persona.id})

    disponibles = [m['id'] for m in respuesta.data]
    assert en_baja.id in disponibles
    assert materia.id not in disponibles


# --- Listados derivados de inscripciones --------------------------------------------------------

@pytest.mark.django_db
def test_listado_de_inscripciones_del_estudiante_omite_las_bajas(api_as, estudiante, materia):
    en_baja = InscripcionFactory(estudiante=estudiante.persona, estado=Estado.BAJA)

    respuesta = api_as(estudiante).get('/api/inscripciones/', {'estudiante': estudiante.persona.id})

    listadas = ids(respuesta)
    assert en_baja.id not in listadas
    assert len(listadas) == 1


@pytest.mark.django_db
def test_estudiante_no_puede_pedir_las_bajas_con_incluir_baja(api_as, estudiante, materia):
    en_baja = InscripcionFactory(estudiante=estudiante.persona, estado=Estado.BAJA)

    respuesta = api_as(estudiante).get('/api/inscripciones/', {'estudiante': estudiante.persona.id, 'incluir_baja': 'true'})

    assert en_baja.id not in ids(respuesta)


@pytest.mark.django_db
def test_administrador_ve_las_bajas_solo_si_las_pide(api_as, admin, estudiante, materia):
    en_baja = InscripcionFactory(estudiante=estudiante.persona, estado=Estado.BAJA)
    cliente = api_as(admin)

    por_defecto = cliente.get('/api/inscripciones/', {'estudiante': estudiante.persona.id})
    explicito = cliente.get('/api/inscripciones/', {'estudiante': estudiante.persona.id, 'incluir_baja': 'true'})

    assert en_baja.id not in ids(por_defecto)
    assert en_baja.id in ids(explicito)


@pytest.mark.django_db
def test_materias_por_estudiante_omite_las_bajas(api_as, admin, estudiante, materia):
    en_baja = InscripcionFactory(estudiante=estudiante.persona, estado=Estado.BAJA).materia

    respuesta = api_as(admin).get(f'/api/materias/por-estudiante/{estudiante.persona.id}/')

    assert ids(respuesta) == [materia.id]
    assert en_baja.id not in ids(respuesta)


@pytest.mark.django_db
def test_total_estudiantes_de_la_materia_no_cuenta_las_bajas(api_as, admin, materia):
    InscripcionFactory(materia=materia, estado=Estado.BAJA)
    InscripcionFactory(materia=materia, estado=Estado.LIBRE)

    respuesta = api_as(admin).get(f'/api/materias/{materia.id}/')

    assert respuesta.data['total_estudiantes'] == 2


# --- Reinscripción sobre una fila en BAJA -------------------------------------------------------

@pytest.mark.django_db
def test_reinscribir_sobre_baja_reactiva_la_fila_sin_tocar_las_notas_previas(api_as, admin, profesor, estudiante, materia, contenido):
    entrega = Entrega.objects.create(actividad=contenido['actividad'], estudiante=estudiante.persona, contenido_texto='TP')
    nota = Nota.objects.create(entrega=entrega, profesor=profesor.persona, calificacion=7)
    inscripcion = Inscripcion.objects.get(materia=materia, estudiante=estudiante.persona)
    poner_estado(materia, estudiante, Estado.BAJA)  # baja administrativa previa, con nota ya asentada

    respuesta = api_as(admin).post(
        '/api/inscripciones/inscribir/',
        {'estudiante_id': estudiante.persona.id, 'materia_ids': [materia.id]},
        format='json',
    )

    assert respuesta.status_code == 201
    inscripciones = Inscripcion.objects.filter(materia=materia, estudiante=estudiante.persona)
    assert [i.id for i in inscripciones] == [inscripcion.id]  # misma fila: la restricción única se respeta
    assert inscripciones.get().estado == Estado.CURSANDO
    # La nota y la entrega previas siguen ligadas a la misma entrega y no se duplican
    assert Entrega.objects.filter(estudiante=estudiante.persona, actividad=contenido['actividad']).count() == 1
    assert list(Nota.objects.values_list('id', 'entrega_id', 'calificacion')) == [(nota.id, entrega.id, nota.calificacion)]
