from django.contrib.auth import authenticate, login
from rest_framework import viewsets, status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Rol, Persona
from .serializers import RolSerializer, PersonaSerializer, DNITokenObtainPairSerializer, UsuarioSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from academico.models import Materia
from django.utils import timezone


class UsuarioCreateView(generics.CreateAPIView):
    serializer_class = UsuarioSerializer

class DNITokenObtainPairView(TokenObtainPairView):
    serializer_class = DNITokenObtainPairSerializer

class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all()
    serializer_class = RolSerializer

class PersonaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Persona.objects.filter(fecha_baja__isnull=True)
    serializer_class = PersonaSerializer

    def destroy(self, request, *args, **kwargs):
        persona = self.get_object()
        rol_nombre = persona.rol.nombre 
                
        if rol_nombre == "Profesor":
            tiene_materias = Materia.objects.filter(profesor=persona).exists()

            if tiene_materias:
                return Response(
                    {'detail': 'No se puede eliminar un profesor con materias asignadas.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        elif rol_nombre == "Alumno":
            tiene_materias = Materia.objects.filter(alumno=persona).exists()
            if tiene_materias:
                return Response(
                    {'detail': 'No se puede eliminar un alumno con materias asignadas.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        persona.fecha_baja = timezone.now().date()
        persona.save()
        if rol_nombre == 'Profesor':
               return Response({'detail': 'Profesor {persona.apellido}, {persona.nombre} se ha eliminado correctamente.'.format(persona=persona)}, status=status.HTTP_200_OK)
        elif rol_nombre == 'Alumno':
               return Response({'detail': 'Alumno {persona.apellido}, {persona.nombre} se ha eliminado correctamente.'.format(persona=persona)}, status=status.HTTP_200_OK)
        
        return Response({'detail': 'Registro eliminado correctamente.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def restaurar(self, request, pk=None):
    
        persona = Persona.objects.filter(pk=pk).first()
        if not persona:
            return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        
        persona.restore()
        return Response({'detail': 'Persona restaurada correctamente.'}, status=status.HTTP_200_OK)

class PersonaRolView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        rol_id = request.query_params.get('rol')
        
        if not rol_id:
            return Response(
                {"error": "Debe especificar el rol."},
                status=status.HTTP_400_BAD_REQUEST
            )

        personas = (
            Persona.objects
            .filter(rol_id=rol_id, fecha_baja__isnull=True)
            .select_related('rol')
            .order_by('apellido', 'nombre')
        )
        serializer = PersonaSerializer(personas, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)



class PerfilUsuarioView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        usuario = request.user
        persona = getattr(usuario, 'persona', None)

        rol_id = None
        rol_nombre = None
        if persona and persona.rol:
            rol_id = persona.rol.id
            rol_nombre = persona.rol.nombre

        data = {
            "id": usuario.id,
            "userName": usuario.username,
            "rolId": rol_id,
            "rolNombre": rol_nombre,
            "persona": {
                "id": persona.id if persona else None,
                "nombre": persona.nombre if persona else "",
                "apellido": persona.apellido if persona else "",
                "dni": persona.dni if persona else "",
                "email": persona.email if persona else "",
                "tel_contacto": persona.tel_contacto if persona else ""
            } if persona else None
        }
        return Response(data, status=status.HTTP_200_OK)