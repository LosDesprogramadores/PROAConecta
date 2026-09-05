# 🚀 Backend API - Django

Servicio backend desarrollado con Python y Django. Proporciona la lógica de negocio, persistencia de datos y endpoints para la aplicación.

---

## 🛠️ Tecnologías

* **Python** (v3.10+)
* **Django** (v5.x+)
* **Django REST Framework** *(si aplica)*
* **Base de datos:** SQLite (desarrollo) / PostgreSQL (producción)

---

## 📋 Requisitos previos

Asegúrate de tener instalado:
* Python 3.10 o superior
* Git
* Gestor de paquetes `pip`

---

## Roles, Personas y Usuarios en DB de Prueba actuales en la DB

Rol 1- Administrador Ana Gomez: 
DNI(username): 12345678
PASS: 12345678

Rol 2- profesor Alan Profesor:
DNI(username): 35785659
PASS: 35785659

Rol 3- Estudiante Julio Estudiante:
DNI(username): 333111333
PASS: 333111333


## En los siguientes pasos siempre deben tener en consideraciòn la posiciòn donde estàn y donde se encuentra el archivo a ajecutar.

## 1- Crear y activar el entorno virtual

python3 -m venv venv
source venv/bin/activate

---

## 2- Instalar dependencias

pip install -r requirements.txt

---

## 3- Base de datos y migraciones

python manage.py makemigrations
python manage.py migrate

---

## 4- Crear cuenta de administrador

python manage.py createsuperuser

---

## 5- Ejecución del servidor

python manage.py runserver

---

## 6- Tenemos que abrir una terminar nueva para cargar los primeros datos en la Base de Datos por Bash

## En entonrno virtual y parados en backend/proa, tiramos comando python manage.py shell

Para crear usuarios hay que tener 2 terminales abiertas con su virtualenv activado

Una corriendo django y en la otra correr el siguiente comando:

python manage.py shell

En este shell de django se puede probar la app de django desde consola, la idea es que vayan tirando las líneas siguientes para 
que puedan crear 1ero La persona y 2do el Usuario


CREAR EL USUARIO
#================

from usuario.models import Persona, Usuario
from datetime import date

persona = Persona.objects.create(
    nombre='Ana',
    apellido='Gómez',
    dni='test', 
    fecha_nacimiento=date(1995, 5, 20),
)

usuario = Usuario.objects.create_user(
    username='test',  
    password='test',
    email= 'test@x.com', 
    persona=persona,
)


VALIDAR EL USUARIO
#==================

from django.contrib.auth import authenticate

usuario_autenticado = authenticate(dni='test', password='test')
print(usuario_autenticado) # si da None algo le pifiaron, debería devolver el DNI

---

## 7- Cargar Roles(Antes de crear nuevos usuarios hay que crear los roles)
 
  Entrar al administrador(tiene que estar el server corriendo) http://127.0.0.1:8000/admin/
  
  Ingresar las creadenciales creadas en el punto 4  

  Crear los 3 Roles 
  Administrador (1)
  Profesor (2)
  Estudiante (3)

  ---

## 8- Cargar una nueva persona

Debemos obtener el token el cual es mandando una peticiòn a: (Post) http://127.0.0.1:8000/api/auth/login/
 
 Siempre y cuando no se modificaron los datos del punto 6, los datos son los siguientes:

 json
     {
      "dni":"test",
      "password":"test",
     }

En el caso de haber modificados los datos del punto 6, se debe modificar el json con los datos nuevos.

Al mandar la peticiòn nos devolvera un token y un refresh, copiar ese token y pegarlo en la autorizaciòn de la peticiòn siguiente.

Mandar una nueva peticiòn para crear otros usuarios a : (post) http://127.0.0.1:8000/api/personas/ 

{
    "nombre": "Prueba",
    "apellido": "Prueba",
    "dni": "123",
    "fecha_nacimiento": "1995-05-20",
    "tel_contacto": "3456677898",
    "email": "Prueba@gmail.com",
    "rol": 1
  }

  IMPRTANTE no olvidar de pegar el token obtenido anteriormente


## 9 -Catálogo de Materias (academico)

    Crear Materia
    Método: POST
    Endpoint: /materias/

    Body (JSON):
        {
        "titulo": "Programación I",
        "anio": 2026,
        "curso": "1ro A",
        "descripcion": "Fundamentos de lógica y algoritmos",
        "criterios_evaluacion": "70% TPs, 30% Parcial",
        "profesor": 2
        }

    El campo profesor es opcional; si no se asigna al crear, enviar null o no incluir la clave

        Listar Materias
        Método: GET
        Endpoint: /materias/

    Filtros disponibles por Query Params:

        ?anio=2026
        ?curso=1ro A
        ?profesor=2 (Materias que dicta un profesor específico)
        ?search=Programacion (Búsqueda por título, curso o nombre del profesor)


    Respuesta (200 OK):

    [
        {
            "id": 1,
            "titulo": "Programación I",
            "descripcion": "Fundamentos y lógica de programación",
            "criterios_evaluacion": "70% TPs, 30% Parcial",
            "anio": 2026,
            "curso": "1ro A",
            "profesor": 2,
            "profesor_detalle": {
                "id": 2,
                "dni": "40123456",
                "nombre": "Carlos",
                "apellido": "Pérez",
                "nombre_completo": "Pérez, Carlos",
                "email": "carlos.perez@aula.com",
                "rol_nombre": "profesor"
            },
            "total_estudiantes": 25,
            "activo": true,
            "fecha_creacion": "2026-08-26T22:50:00Z",
            "fecha_actualizacion": "2026-08-26T22:52:00Z"
        }
        ]

    Asignar, Cambiar o Quitar profesor
        Método: PATCH
        Endpoint: /materias/{id}/
        Body (JSON):
        Asignar / Cambiar: {"profesor": 2}
        Dejar sin profesor: {"profesor": null}

        Respuesta (200 OK): Objeto Materia actualizado.

    Eliminar Materia
        Método: DELETE
        Endpoint: /materias/{id}/
        Respuesta: 204 No Content

    Consultar Alumnos Disponibles para Matricular
        Método: GET
        Endpoint: /materias/{id}/estudiantes-disponibles/
        Uso: Carga el modal de matriculación con los estudiantes activos que aún no pertenecen a esta materia.
        Respuesta (200 OK):

        JSON
        [
        {
            "id": 5,
            "dni": "45111222",
            "nombre": "Lucía",
            "apellido": "Martínez",
            "nombre_completo": "Martínez, Lucía",
            "email": "lucia@aula.com",
            "rol_nombre": "Estudiante"
        }
        ]
        4. Cursadas e Inscripciones (academico)

    Inscribir un Estudiante (1 a 1)
        Método: POST
        Endpoint: /inscripciones/
        Body (JSON):

        JSON
        {
        "materia": 1,
        "estudiante": 5
        }
        Respuesta (201 Created):

        JSON
        {
        "id": 18,
        "materia": 1,
        "materia_titulo": "Programación I",
        "estudiante": 5,
        "estudiante_detalle": {
            "id": 5,
            "dni": "45111222",
            "nombre": "Lucía",
            "apellido": "Martínez",
            "nombre_completo": "Martínez, Lucía",
            "email": "lucia@aula.com",
            "rol_nombre": "Estudiante"
        },
        "estado": "ACTIVA",
        "fecha_inscripcion": "2026-08-27"
        }

    Listar Alumnos Inscriptos en una Materia
        Método: GET
        Endpoint: /inscripciones/?materia={id_materia}
        Uso: Vista de lista de curso dentro del aula virtual.

        Respuesta (200 OK): Lista de inscripciones de esa materia.

-----------------------------------------------------------------------------------

    Listar Materias Cursadas por un Alumno ("Mis Cursadas")
        Método: GET
        Endpoint: /inscripciones/?estudiante={id_estudiante}
        Uso: Dashboard del estudiante para ver sus materias asignadas.
        Respuesta (200 OK): Lista de inscripciones del estudiante.

-----------------------------------------------------------------------------------

    Listar Mis Materias (Dashboard por Rol)
        Método: GET
        Endpoint: /materias/mis-materias/
        Uso: Endpoint para el dashboard de catalogo de materias creadas y vista de lista de Materias segun el rol de profesor o alumno.

            - Administrador (rol ID 1 o superusuario): Devuelve la totalidad de materias del catálogo general.
            - Profesor: Devuelve únicamente las materias donde se encuentra asignado como docente titular.
            - Estudiante: Devuelve únicamente las materias en las que posee una inscripción activa.
            - Sin asignaciones: Retorna un array vacío [] con código 200 OK para renderizar el estado vacío (Empty State) en la interfaz.

        Respuesta (200 OK):

        [
            {
                "id": 1,
                "titulo": "Programación I",
                "descripcion": "Fundamentos y lógica de programación",
                "criterios_evaluacion": "70% TPs, 30% Parcial",
                "anio": 2026,
                "curso": "1ro A",
                "profesor": 2,
                "profesor_detalle": {
                    "id": 2,
                    "dni": "40123456",
                    "nombre": "Carlos",
                    "apellido": "Pérez",
                    "nombre_completo": "Pérez, Carlos",
                    "email": "carlos.perez@aula.com",
                    "rol_nombre": "profesor"
                },
                "total_estudiantes": 25,
                "activo": true,
                "fecha_creacion": "2026-08-26T22:50:00Z",
                "fecha_actualizacion": "2026-08-26T22:52:00Z"
            }
        ]

    Modificar Condición Académica del Alumno
        Método: PATCH
        Endpoint: /inscripciones/{id}/
        Valores admitidos para estado: "CURSANDO", "REGULAR", "PROMOCIONADO", "LIBRE", "BAJA".

        Body (JSON):

        JSON
        {
        "estado": "REGULAR"
        }
        Respuesta (200 OK): Objeto Inscripcion actualizado.

    Desvincular / Dar de Baja Estudiante de la Materia
        Método: DELETE
        Endpoint: /inscripciones/{id}/
        Respuesta: 204 No Content

