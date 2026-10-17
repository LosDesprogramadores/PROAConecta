import pytest
from django.core.files.base import ContentFile
from django.urls import resolve
from django.utils import timezone

from academico.models import Inscripcion
from academico.tests.factories import InscripcionFactory, MateriaFactory
from aula_virtual.models import Actividad, Entrega, Material, Unidad
from usuario.tests.factories import UsuarioFactory

CONTENIDO = b'%PDF-1.4\ncontenido secreto\n'


def url(tipo, pk):
    return f'/api/archivos/{tipo}/{pk}/'


@pytest.fixture
def material(materia_con_inscripcion):
    m = Material.objects.create(materia=materia_con_inscripcion, titulo='Guía de estudio', tipo='DOCUMENTO')
    m.archivo.save('guia.pdf', ContentFile(CONTENIDO))
    return m


@pytest.fixture
def actividad(materia_con_inscripcion):
    a = Actividad.objects.create(
        materia=materia_con_inscripcion, titulo='TP 1', estado=Actividad.EstadoActividad.PUBLICADA
    )
    a.archivo_adjunto.save('consigna.pdf', ContentFile(CONTENIDO))
    return a


@pytest.fixture
def entrega(actividad, estudiante):
    e = Entrega.objects.create(actividad=actividad, estudiante=estudiante.persona)
    e.archivo.save('respuesta.pdf', ContentFile(CONTENIDO))
    return e


@pytest.fixture
def ajeno(rol_estudiante):
    return UsuarioFactory(persona__rol=rol_estudiante)


def contenido(respuesta):
    return b''.join(respuesta.streaming_content)


# --- Respuesta ---

@pytest.mark.django_db
def test_material_se_descarga_como_adjunto_con_nombre_seguro(api_as, estudiante, material):
    respuesta = api_as(estudiante).get(url('material', material.id))

    assert respuesta.status_code == 200
    assert contenido(respuesta) == CONTENIDO
    disposicion = respuesta['Content-Disposition']
    assert disposicion.startswith('attachment')
    assert 'guia-de-estudio.pdf' in disposicion
    assert material.archivo.name.split('/')[-1] not in disposicion  # el uuid interno no se expone
    assert respuesta['Content-Type'] == 'application/octet-stream'
    assert respuesta['X-Content-Type-Options'] == 'nosniff'


@pytest.mark.django_db
def test_el_tipo_se_ignora_y_siempre_es_octet_stream(api_as, profesor, materia_con_inscripcion):
    m = Material.objects.create(materia=materia_con_inscripcion, titulo='Imagen')
    m.archivo.save('foto.png', ContentFile(b'\x89PNG\r\n\x1a\n'))

    respuesta = api_as(profesor).get(url('material', m.id))

    assert respuesta['Content-Type'] == 'application/octet-stream'


@pytest.mark.django_db
def test_nombre_con_caracteres_peligrosos_se_sanea(api_as, profesor, materia_con_inscripcion):
    m = Material.objects.create(materia=materia_con_inscripcion, titulo='../../etc/pass"wd\r\nX: y')
    m.archivo.save('a.pdf', ContentFile(CONTENIDO))

    respuesta = api_as(profesor).get(url('material', m.id))

    assert respuesta.status_code == 200
    assert '/' not in respuesta['Content-Disposition'].split('filename=')[-1]
    assert '\n' not in respuesta['Content-Disposition']


@pytest.mark.django_db
def test_tipo_desconocido_devuelve_404(api_as, admin):
    assert api_as(admin).get(url('foro', 1)).status_code == 404


@pytest.mark.django_db
def test_sin_archivo_adjunto_devuelve_404(api_as, profesor, materia_con_inscripcion):
    m = Material.objects.create(materia=materia_con_inscripcion, titulo='Solo enlace', enlace='https://example.com')
    assert api_as(profesor).get(url('material', m.id)).status_code == 404


@pytest.mark.django_db
def test_archivo_borrado_del_disco_devuelve_404(api_as, profesor, material):
    material.archivo.delete(save=False)
    assert api_as(profesor).get(url('material', material.id)).status_code == 404


# --- Matriz: material y adjunto de actividad ---

@pytest.mark.django_db
@pytest.mark.parametrize('tipo,fixture', [('material', 'material'), ('actividad', 'actividad')])
def test_anonimo_recibe_401(cliente_anonimo, request, tipo, fixture):
    objeto = request.getfixturevalue(fixture)
    assert cliente_anonimo.get(url(tipo, objeto.id)).status_code == 401


@pytest.mark.django_db
@pytest.mark.parametrize('tipo,fixture', [('material', 'material'), ('actividad', 'actividad')])
def test_acceden_el_estudiante_inscripto_el_titular_y_el_administrador(api_as, request, estudiante, profesor, admin, tipo, fixture):
    objeto = request.getfixturevalue(fixture)
    for usuario in (estudiante, profesor, admin):
        assert api_as(usuario).get(url(tipo, objeto.id)).status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize('tipo,fixture', [('material', 'material'), ('actividad', 'actividad')])
def test_estudiante_ajeno_y_profesor_de_otra_materia_no_acceden(api_as, request, ajeno, rol_profesor, tipo, fixture):
    objeto = request.getfixturevalue(fixture)
    otro_profesor = UsuarioFactory(persona__rol=rol_profesor)
    assert api_as(ajeno).get(url(tipo, objeto.id)).status_code == 404
    assert api_as(otro_profesor).get(url(tipo, objeto.id)).status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize('tipo,fixture', [('material', 'material'), ('actividad', 'actividad')])
def test_estudiante_en_baja_no_accede(api_as, request, estudiante, materia_con_inscripcion, tipo, fixture):
    objeto = request.getfixturevalue(fixture)
    Inscripcion.objects.filter(materia=materia_con_inscripcion, estudiante=estudiante.persona).update(
        estado=Inscripcion.EstadoInscripcion.BAJA
    )
    assert api_as(estudiante).get(url(tipo, objeto.id)).status_code == 404


@pytest.mark.django_db
def test_material_oculto_solo_lo_ven_titular_y_administrador(api_as, estudiante, profesor, admin, material):
    material.visible = False
    material.save(update_fields=['visible'])

    assert api_as(estudiante).get(url('material', material.id)).status_code == 404
    assert api_as(profesor).get(url('material', material.id)).status_code == 200
    assert api_as(admin).get(url('material', material.id)).status_code == 200


@pytest.mark.django_db
def test_material_de_unidad_oculta_no_lo_ve_el_estudiante(api_as, estudiante, material, materia_con_inscripcion):
    unidad = Unidad.objects.create(materia=materia_con_inscripcion, titulo='U1', visible=False)
    material.unidad = unidad
    material.save(update_fields=['unidad'])

    assert api_as(estudiante).get(url('material', material.id)).status_code == 404


@pytest.mark.django_db
def test_material_dado_de_baja_no_lo_ve_el_estudiante_pero_si_el_titular(api_as, estudiante, profesor, material):
    material.soft_delete()

    assert api_as(estudiante).get(url('material', material.id)).status_code == 404
    assert api_as(profesor).get(url('material', material.id)).status_code == 200


@pytest.mark.django_db
def test_materia_dada_de_baja_solo_la_ve_el_administrador(api_as, estudiante, profesor, admin, material, materia_con_inscripcion):
    materia_con_inscripcion.fecha_baja = timezone.now()
    materia_con_inscripcion.save(update_fields=['fecha_baja'])

    assert api_as(estudiante).get(url('material', material.id)).status_code == 404
    assert api_as(profesor).get(url('material', material.id)).status_code == 404
    assert api_as(admin).get(url('material', material.id)).status_code == 200


@pytest.mark.django_db
def test_actividad_en_borrador_no_la_ve_el_estudiante(api_as, estudiante, profesor, actividad):
    actividad.estado = Actividad.EstadoActividad.BORRADOR
    actividad.save(update_fields=['estado'])

    assert api_as(estudiante).get(url('actividad', actividad.id)).status_code == 404
    assert api_as(profesor).get(url('actividad', actividad.id)).status_code == 200


# --- Matriz: entrega ---

@pytest.mark.django_db
def test_entrega_la_ven_el_dueno_el_titular_y_el_administrador(api_as, estudiante, profesor, admin, entrega):
    for usuario in (estudiante, profesor, admin):
        assert api_as(usuario).get(url('entrega', entrega.id)).status_code == 200


@pytest.mark.django_db
def test_entrega_no_la_ve_otro_estudiante_inscripto_en_la_misma_materia(api_as, ajeno, entrega, materia_con_inscripcion):
    InscripcionFactory(materia=materia_con_inscripcion, estudiante=ajeno.persona)
    assert api_as(ajeno).get(url('entrega', entrega.id)).status_code == 404


@pytest.mark.django_db
def test_entrega_no_la_ve_el_profesor_de_otra_materia(api_as, rol_profesor, entrega):
    otro = UsuarioFactory(persona__rol=rol_profesor)
    MateriaFactory(profesor=otro.persona)
    assert api_as(otro).get(url('entrega', entrega.id)).status_code == 404


@pytest.mark.django_db
def test_entrega_con_el_dueno_en_baja_no_se_descarga(api_as, estudiante, entrega, materia_con_inscripcion):
    Inscripcion.objects.filter(materia=materia_con_inscripcion, estudiante=estudiante.persona).update(
        estado=Inscripcion.EstadoInscripcion.BAJA
    )
    assert api_as(estudiante).get(url('entrega', entrega.id)).status_code == 404


@pytest.mark.django_db
def test_entrega_dada_de_baja_no_la_ve_el_dueno(api_as, estudiante, profesor, entrega):
    entrega.soft_delete()
    assert api_as(estudiante).get(url('entrega', entrega.id)).status_code == 404
    assert api_as(profesor).get(url('entrega', entrega.id)).status_code == 200


# --- Serializers y rutas públicas ---

@pytest.mark.django_db
def test_los_serializers_exponen_la_ruta_de_descarga_y_no_media(api_as, estudiante, profesor, material, actividad, entrega):
    cliente = api_as(profesor)

    datos_material = cliente.get(f'/api/materiales/{material.id}/').data
    datos_actividad = cliente.get(f'/api/actividades/{actividad.id}/').data
    datos_entrega = api_as(estudiante).get(f'/api/entregas/{entrega.id}/').data

    assert datos_material['archivo'] == url('material', material.id)
    assert datos_actividad['archivo_adjunto'] == url('actividad', actividad.id)
    assert datos_entrega['archivo'] == url('entrega', entrega.id)
    # La ruta devuelta existe en el router
    assert resolve(datos_material['archivo']).url_name == 'descarga-archivo'


@pytest.mark.django_db
def test_sin_archivo_el_serializer_devuelve_null(api_as, profesor, materia_con_inscripcion):
    m = Material.objects.create(materia=materia_con_inscripcion, titulo='Enlace', enlace='https://example.com')
    assert api_as(profesor).get(f'/api/materiales/{m.id}/').data['archivo'] is None


@pytest.mark.django_db
def test_media_ya_no_se_sirve_sin_autenticacion(cliente_anonimo, material, settings):
    # La suite corre con DEBUG False: no hay ruta pública hacia MEDIA_URL
    assert cliente_anonimo.get(f'{settings.MEDIA_URL}{material.archivo.name}').status_code == 404
