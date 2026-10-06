import re

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from aula_virtual.models import Actividad, Entrega, Material
from core.storage import RutaUnica
from core.validators import TAMANO_MAXIMO_BYTES, validar_archivo

PDF = b'%PDF-1.4\n%contenido de prueba\n'
PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 16
JPG = b'\xff\xd8\xff\xe0' + b'\x00' * 16
ZIP = b'PK\x03\x04' + b'\x00' * 16
PATRON_RUTA = r'^{carpeta}/\d{{4}}/\d{{2}}/[0-9a-f]{{32}}\.{ext}$'


def subir(nombre, contenido, tipo='application/octet-stream'):
    return SimpleUploadedFile(nombre, contenido, content_type=tipo)


# --- validar_archivo ---

@pytest.mark.parametrize('nombre,contenido', [
    ('apunte.pdf', PDF),
    ('foto.png', PNG),
    ('foto.jpg', JPG),
    ('foto.JPEG', JPG),
    ('trabajo.docx', ZIP),
    ('planilla.xlsx', ZIP),
    ('clase.pptx', ZIP),
    ('todo.zip', ZIP),
    ('notas.txt', 'ñandú con tilde'.encode('utf-8')),
])
def test_acepta_los_tipos_permitidos(nombre, contenido):
    validar_archivo(subir(nombre, contenido))


@pytest.mark.parametrize('nombre', ['pagina.html', 'programa.exe', 'script.js', 'sin_extension', 'doble.pdf.exe'])
def test_rechaza_extensiones_no_permitidas(nombre):
    from django.core.exceptions import ValidationError

    with pytest.raises(ValidationError) as error:
        validar_archivo(subir(nombre, PDF))
    assert 'no está permitido' in str(error.value)


def test_rechaza_archivos_de_mas_de_10_mb():
    from django.core.exceptions import ValidationError

    grande = subir('grande.pdf', PDF + b'0' * TAMANO_MAXIMO_BYTES)
    with pytest.raises(ValidationError) as error:
        validar_archivo(grande)
    assert '10 MB' in str(error.value)


def test_acepta_el_limite_exacto():
    validar_archivo(subir('justo.pdf', PDF + b'0' * (TAMANO_MAXIMO_BYTES - len(PDF))))


@pytest.mark.parametrize('nombre,contenido', [
    ('falso.pdf', b'<html><script>alert(1)</script></html>'),
    ('falso.png', PDF),
    ('falso.jpg', PNG),
    ('falso.docx', PDF),
    ('falso.txt', b'texto\x00binario'),
])
def test_rechaza_contenido_que_no_coincide_con_la_extension(nombre, contenido):
    from django.core.exceptions import ValidationError

    with pytest.raises(ValidationError) as error:
        validar_archivo(subir(nombre, contenido))
    assert 'no coincide' in str(error.value)


def test_deja_el_puntero_al_inicio_para_que_se_guarde_completo():
    archivo = subir('apunte.pdf', PDF)
    validar_archivo(archivo)
    assert archivo.read() == PDF


# --- RutaUnica ---

def test_ruta_unica_usa_uuid_extension_original_y_carpeta_por_anio_y_mes():
    ruta = RutaUnica('materiales')(None, 'Parcial Final.PDF')
    assert re.match(PATRON_RUTA.format(carpeta='materiales', ext='pdf'), ruta)
    assert 'Parcial' not in ruta


def test_ruta_unica_no_repite_nombres():
    generar = RutaUnica('entregas')
    assert generar(None, 'a.pdf') != generar(None, 'a.pdf')


def test_ruta_unica_es_serializable_para_migraciones():
    nombre, args, _ = RutaUnica('actividades').deconstruct()
    assert nombre == 'core.storage.RutaUnica'
    assert args == ('actividades',)


# --- Integración con la API ---

@pytest.fixture
def actividad(materia_con_inscripcion):
    return Actividad.objects.create(
        materia=materia_con_inscripcion, titulo='TP', estado=Actividad.EstadoActividad.PUBLICADA
    )


@pytest.mark.django_db
def test_material_se_guarda_con_nombre_uuid(api_as, profesor, materia_con_inscripcion):
    respuesta = api_as(profesor).post('/api/materiales/', {
        'materia': materia_con_inscripcion.id, 'titulo': 'Guía', 'tipo': 'DOCUMENTO',
        'archivo': subir('Guía de estudio.pdf', PDF),
    }, format='multipart')

    assert respuesta.status_code == 201, respuesta.data
    material = Material.objects.get(pk=respuesta.data['id'])
    assert re.match(PATRON_RUTA.format(carpeta='materiales', ext='pdf'), material.archivo.name)


@pytest.mark.django_db
@pytest.mark.parametrize('nombre', ['pagina.html', 'programa.exe'])
def test_material_con_extension_no_permitida_devuelve_400_en_espanol(api_as, profesor, materia_con_inscripcion, nombre):
    respuesta = api_as(profesor).post('/api/materiales/', {
        'materia': materia_con_inscripcion.id, 'titulo': 'Malo', 'tipo': 'DOCUMENTO',
        'archivo': subir(nombre, PDF),
    }, format='multipart')

    assert respuesta.status_code == 400
    assert 'no está permitido' in str(respuesta.data['archivo'])
    assert not Material.objects.filter(titulo='Malo').exists()


@pytest.mark.django_db
def test_actividad_con_adjunto_enorme_devuelve_400(api_as, profesor, materia_con_inscripcion):
    respuesta = api_as(profesor).post('/api/actividades/', {
        'materia': materia_con_inscripcion.id, 'titulo': 'Grande', 'estado': 'BORRADOR',
        'archivo_adjunto': subir('grande.pdf', PDF + b'0' * TAMANO_MAXIMO_BYTES),
    }, format='multipart')

    assert respuesta.status_code == 400
    assert '10 MB' in str(respuesta.data['archivo_adjunto'])


@pytest.mark.django_db
def test_actividad_acepta_adjunto_valido_con_nombre_uuid(api_as, profesor, materia_con_inscripcion):
    respuesta = api_as(profesor).post('/api/actividades/', {
        'materia': materia_con_inscripcion.id, 'titulo': 'Con adjunto', 'estado': 'BORRADOR',
        'archivo_adjunto': subir('consigna.png', PNG),
    }, format='multipart')

    assert respuesta.status_code == 201, respuesta.data
    actividad = Actividad.objects.get(pk=respuesta.data['id'])
    assert re.match(PATRON_RUTA.format(carpeta='actividades', ext='png'), actividad.archivo_adjunto.name)


@pytest.mark.django_db
def test_entrega_rechaza_ejecutable_y_acepta_pdf(api_as, estudiante, actividad):
    cliente = api_as(estudiante)

    malo = cliente.post('/api/entregas/', {'actividad': actividad.id, 'archivo': subir('virus.exe', b'MZ')}, format='multipart')
    assert malo.status_code == 400
    assert 'archivo' in malo.data

    bueno = cliente.post('/api/entregas/', {'actividad': actividad.id, 'archivo': subir('tp.pdf', PDF)}, format='multipart')
    assert bueno.status_code == 201, bueno.data
    entrega = Entrega.objects.get(pk=bueno.data['id'])
    assert re.match(PATRON_RUTA.format(carpeta='entregas', ext='pdf'), entrega.archivo.name)
