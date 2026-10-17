import factory

from academico.models import Inscripcion, Materia
from usuario.tests.factories import PersonaFactory


class MateriaFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Materia

    titulo = factory.Sequence(lambda n: f'Materia {n}')
    anio = 2026
    curso = '1ro A'
    profesor = None


class InscripcionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Inscripcion

    materia = factory.SubFactory(MateriaFactory)
    estudiante = factory.SubFactory(PersonaFactory)


def cargar_nota(actividad, estudiante, calificacion):
    # Entrega corregida con su nota, sin pasar por el flujo del profesor
    from aula_virtual.models import Entrega, Nota

    entrega = Entrega.objects.create(
        actividad=actividad, estudiante=estudiante, estado=Entrega.EstadoEntrega.CORREGIDO
    )
    return Nota.objects.create(entrega=entrega, calificacion=calificacion)


def crear_actividad(materia, titulo, **extra):
    from aula_virtual.models import Actividad

    return Actividad.objects.create(materia=materia, titulo=titulo, descripcion='x', **extra)
