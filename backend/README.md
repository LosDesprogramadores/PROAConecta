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

    ##Creamos la Persona

        from usuario.models import Persona, Usuario
        from datetime import date

        persona = Persona.objects.create(
            nombre='Ana',
            apellido='Gómez',
            dni='test', # Es único no se puede repetir
            fecha_nacimiento=date(1995, 5, 20),
        )

    ## Creamos el Usuario

        from usuario.models import Persona, Usuario
        from datetime import date

        persona = Persona.objects.create(
            nombre='Ana',
            apellido='Gómez',
            dni='test', # Es único no se puede repetir
            fecha_nacimiento=date(1995, 5, 20),
        )

    ## Validar Usuario

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


