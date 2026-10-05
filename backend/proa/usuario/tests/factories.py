import factory

from usuario.models import Persona, Rol, Usuario

PASSWORD_PRUEBA = 'Clave-de-prueba-123'


class RolFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Rol
        django_get_or_create = ('nombre',)

    nombre = 'Estudiante'


class PersonaFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Persona

    rol = factory.SubFactory(RolFactory)
    nombre = factory.Sequence(lambda n: f'Nombre{n}')
    apellido = factory.Sequence(lambda n: f'Apellido{n}')
    dni = factory.Sequence(lambda n: f'{30000000 + n}')
    fecha_nacimiento = '2000-01-01'
    email = factory.Sequence(lambda n: f'persona{n}@ejemplo.test')


class UsuarioFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Usuario
        skip_postgeneration_save = True

    persona = factory.SubFactory(PersonaFactory)
    # El login es por DNI, pero AbstractUser exige un username único
    username = factory.SelfAttribute('persona.dni')
    nombre_usuario = factory.SelfAttribute('persona.dni')
    debe_cambiar_password = False

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        self.set_password(extracted or PASSWORD_PRUEBA)
        if create:
            self.save(update_fields=['password'])
