from django.db import transaction
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import Rol, Persona, Usuario
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class UsuarioSerializer(serializers.ModelSerializer):
    persona_id = serializers.PrimaryKeyRelatedField(
        queryset=Persona.objects.all(),
        source='persona',
        write_only=True,
    )

    class Meta:
        model = Usuario
        fields = ['id', 'persona_id', 'password', 'activo']
        extra_kwargs = {
            'password': {'write_only': True, 'min_length': 8},
        }

    def validate_persona_id(self, persona):
        if hasattr(persona, 'usuario') and persona.usuario is not None:
            raise serializers.ValidationError('Esta persona ya tiene un usuario asociado.')
        return persona

    def create(self, validated_data):
        persona = validated_data.pop('persona')
        password = validated_data.pop('password')

        usuario = Usuario.objects.create_user(
            username=persona.dni,
            password=password,
            persona=persona,
            **validated_data,
        )
        return usuario


class DNITokenObtainPairSerializer(TokenObtainPairSerializer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop('username', None)
        self.fields['dni'] = serializers.CharField()

    def validate(self, attrs):
        dni = attrs.get('dni')
        password = attrs.get('password')

        usuario = authenticate(
            request=self.context.get('request'),
            dni=dni,
            password=password,
        )

        if usuario is None:
            raise serializers.ValidationError(
                'DNI o contraseña incorrectos.',
                code='authorization',
            )

        if not usuario.activo:
            raise serializers.ValidationError(
                'El usuario está inactivo.',
                code='authorization',
            )

        refresh = self.get_token(usuario)

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }

class RolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = '__all__'


class  PersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Persona
        fields = '__all__'

    def create(self, validated_data):
        password = validated_data.get('dni')
        dni = validated_data.get('dni')
        with transaction.atomic():
            persona = Persona.objects.create(**validated_data)

            usuario = Usuario.objects.create_user(
                username=dni,
                password=password,
                persona=persona,
            )
        return persona
        

