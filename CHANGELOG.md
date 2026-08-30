# Changelog

Todos los cambios relevantes de PROA Conecta se documentarán en este archivo.

El formato sigue una estructura basada en [Keep a Changelog](https://keepachangelog.com/) y utiliza versionado semántico.

---

## [0.1.0-alpha] - Agosto 2026

### Added

#### Autenticación y usuarios
- Implementación del endpoint de autenticación mediante JWT.
- Incorporación de autenticación mediante Bearer Token.
- Implementación del sistema de roles para docentes y alumnos.
- Implementación del endpoint de Persona para la gestión de usuarios y roles.
- Integración del login de Angular con el endpoint de autenticación.

#### Navegación y estructura del frontend
- Implementación de la estructura base del frontend en Angular.
- Incorporación de layouts reutilizables.
- Implementación de Header, Sidebar y Footer.
- Implementación de la vista Home.
- Implementación del Dashboard dinámico según el rol del usuario.
- Organización de rutas y componentes reutilizables.

#### Gestión de materias
- Implementación de los modelos correspondientes a Materias.
- Implementación de la estructura CRUD de Materias en el backend.
- Implementación de endpoints para la gestión de Materias.
- Implementación de la vista de listado de Materias en Angular.
- Incorporación del servicio HTTP para el consumo de la API de Materias.

#### Gestión de actividades
- Implementación de los modelos correspondientes a Actividades.
- Implementación de endpoints para la gestión de Actividades.
- Implementación de las vistas de Actividades en Angular.
- Incorporación del servicio HTTP para el consumo de la API de Actividades.

#### Base de datos
- Configuración de PostgreSQL.
- Migración de los modelos del sistema a PostgreSQL.
- Integración de la aplicación con la base de datos.

#### Docker
- Incorporación de configuración para ejecutar el proyecto mediante Docker.
- Configuración de los servicios necesarios para levantar la aplicación y la base de datos en contenedores.

### Changed

- Organización de la arquitectura del frontend para favorecer la reutilización de componentes según el rol del usuario.
- Integración progresiva entre frontend y backend.
- Ajustes en el sistema de roles y validación de endpoints.
- Ajustes en la configuración de la base de datos para permitir su ejecución dentro del entorno dockerizado.

### Fixed

- Corrección de problemas de conexión entre la aplicación y PostgreSQL al ejecutar el proyecto mediante Docker.
- Ajustes en la recepción y manejo del Bearer Token en Angular para mantener la sesión activa.
- Correcciones realizadas durante las pruebas de integración entre frontend y backend.

### Technical

- Backend desarrollado con Django.
- Frontend desarrollado con Angular.
- Base de datos PostgreSQL.
- Autenticación mediante JWT y SimpleJWT.
- Validación de endpoints mediante Postman.
- Dockerización del entorno de ejecución.

### Known Issues

- Algunas funcionalidades del sistema se encuentran en una etapa inicial de implementación.
- El proyecto continúa en desarrollo y pueden producirse cambios en las funcionalidades y en la arquitectura.
- Se requiere continuar mejorando la integración entre los equipos de frontend y backend.

---

## [Unreleased]

### Added

### Changed

### Fixed

### Removed