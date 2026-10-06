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
