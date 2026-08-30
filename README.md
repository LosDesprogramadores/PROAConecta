# PROA Conecta 🚀

> **Evidencia de Aprendizaje N°2: Sprint 0**
> **Módulos:** Full Stack II, Gestión de Proyectos e Ingeniería de Software
> **Tecnicatura Superior en Desarrollo de Software — ISPC (2026)**

---

## 👥 Equipo: "Los Desprogramadores"

| Integrantes |
|---|
| Alan Darel Marini |
| Carlos Maximiliano Scarpatti Vazquez |
| Julio Martin |
| Tomás Monton |
| Emilio Romero |
| Marcelo Portillo |

---

## 📝 Descripción General del Proyecto

**PROA Conecta** es una aplicación web Full Stack orientada a la gestión académica e institucional de la escuela **PROA Embalse**. Su objetivo fundamental es centralizar usuarios, roles, cursos, materias, actividades, entregas, archivos, avisos y notificaciones en una única plataforma unificada, reduciendo de forma drástica la dispersión de información generada actualmente por el uso fragmentado de herramientas como WhatsApp, correos electrónicos y documentos compartidos.

### ❓ Problema que Resuelve

Durante el relevamiento institucional inicial se detectaron serias dificultades para coordinar el ecosistema escolar debido a la descentralización comunicativa. Las problemáticas clave que esta solución mitiga son:

- La desorganización del material de estudio por materia.
- La falta de un canal transparente para el seguimiento de tareas y entregas académicas.
- La dispersión en la comunicación directa entre docentes, estudiantes y padres (canales informales como WhatsApp/Telegram).
- La ausencia de un tablero centralizado para avisos oficiales e instantáneos.
- La dificultad de directivos y tutores para monitorear el progreso pedagógico en tiempo real.

---

## 🏗️ Alcance del MVP (Mínimo Producto Viable)

El desarrollo inicial se focaliza estrictamente en el núcleo de gestión de actividades académicas e institucionales mediante un modelo web multiplataforma responsivo.

### ✅ Incluido en el MVP

- **Gestión de Identidad y Accesos:** Inicio de sesión mediante autenticación externa OAuth (Google).
- **Control de Permisos por Rol:** Estructuración del sistema bajo 3 roles esenciales: Administrador, Docente y Estudiante.
- **Módulo Académico:** Altas, bajas, modificaciones y consultas de cursos y asignaturas.
- **Flujo de Tareas:** Creación y publicación de actividades con carga de archivos adjuntos por docentes, entregas de los estudiantes y posterior revisión/retroalimentación.
- **Interactividad en Tiempo Real:** Envío e inyección de notificaciones instantáneas de avisos o actualizaciones de estado en el dashboard mediante hilos WebSocket.
- **Reportes:** Motor de filtrado y búsqueda avanzada para la exportación de métricas de rendimiento escolar.

### 🚫 Fuera de Alcance Inicial (Mejoras Posteriores)

- Calendario académico avanzado interactivo.
- Foro de discusión institucional completo.
- Módulo independiente y detallado con interfaz dedicada para Padres y Tutores.

---

## 🛠️ Stack Tecnológico Adoptado

El sistema adopta una arquitectura cliente-servidor desacoplada que se interconecta eficientemente mediante servicios RESTful y WebSockets.

| Área | Tecnología | Justificación y Uso |
|:---|:---|:---|
| **Frontend** | Angular | Manejo interactivo de vistas de usuario, lógica del cliente y estados rápidos. |
| **UI Framework** | Bootstrap | Garantiza una interfaz responsive adaptable a cualquier dispositivo móvil o de escritorio. |
| **Backend** | Django & Django REST Framework | Capa lógica de negocio robusta, control de seguridad y exposición de la API REST. |
| **BD Relacional** | PostgreSQL | Base de datos relacional principal para persistir usuarios, roles, cursos, materias y calificaciones. |
| **BD NoSQL** | MongoDB | Almacenamiento flexible para el historial de actividades, logs de auditoría y strings de notificaciones. |
| **Tiempo Real** | Django Channels (WebSockets) | Inyección y recepción en tiempo real de alertas y notificaciones directamente en la UI. |
| **Contenedores** | Docker & Docker Compose | Estandarización de ambientes para desplegar la app local con idéntica configuración entre desarrolladores. |
| **Versionamiento** | GitHub | Control de versiones distribuido y centralización del código base. |
| **Prototipado** | Figma | Diseño y validación visual de la experiencia de usuario (UX/UI). |

---

## 👥 Matriz de Roles y Responsabilidades (Sprint 0)

Para maximizar el aprendizaje técnico de todos los miembros del ISPC, los roles de gestión y programación son dinámicos y rotativos entre los sprints. Para este ciclo de inicio, la configuración es la siguiente:

| Integrante | Rol |
|:---|:---|
| **Carlos Maximiliano Scarpatti Vazquez** | Product Manager (Backlog, Criterios INVEST) / Scrum Master & Líder de Proyecto |
| **Alan Darel Marini** | Backend Developer — Diseño y codificación de API REST, seguridad y lógica de autenticación |
| **Marcelo Portillo** | Backend Developer — Modelado relacional SQL/NoSQL, esquemas de endpoints y persistencia |
| **Tomás Monton** | Frontend Developer — Estructuración de interfaces en Angular, estados y consumo de API |
| **Emilio Romero** | Frontend Developer — Diseño de componentes UI, validación estricta de formularios y UX |
| **Julio Martin** | UX/UI + DevOps — Maquetación en Figma, Dockerización multicapa del entorno y documentación técnica |

---

## 📈 Viabilidad y Presupuesto

**Viabilidad Económica**

El costo inicial estimado de desarrollo es de **$0**. El ecosistema técnico está basado estrictamente en herramientas open-source gratuitas y en capas de servicios en la nube bajo modalidad *free-tier*. El único costo potencial futuro corresponde al dominio institucional web de despliegue final (estimado entre USD 10 y USD 15 anuales).

**Viabilidad Técnica**

Completamente viable dado que no requiere infraestructura externa compleja. El software se desarrolla utilizando las computadoras personales del equipo, aprovechando la portabilidad que proveen los contenedores aislados de Docker.

---

## 📈 Sistema de branch

Descripción aplicada en el proyecto:

https://github.com/LosDesprogramadores/PROAConecta/wiki/Sistema-de-branching

---

## 🚀 Comenzando: Guía de Levantamiento Local

Seguí minuciosamente los pasos detallados a continuación para clonar el proyecto y levantar el ecosistema completo (Frontend, Backend, PostgreSQL y MongoDB) de manera automatizada.

### 📋 Prerrequisitos

Asegurate de contar con el siguiente software instalado de forma nativa:

- [Git CLI](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (debe incluir el binario de `docker-compose`)

### 🔧 Instalación y Despliegue

**1. Clonar el repositorio oficial:**

```bash
git clone https://github.com/LosDesprogramadores/PROAConecta
cd proa-conecta
```

**2. Levantar todos los servicios con Docker Compose:**

```bash
docker-compose up --build
```

**3. Realizar las migraciones pendientes:**

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

Una vez completado el proceso, los servicios estarán disponibles en sus respectivos puertos locales según la configuración definida en el archivo `docker-compose.yml`.

Los usuarios cargados de prueba son:

Rol 1- Administrador Ana Gomez: 
DNI(username): 12345678
PASS: test

Rol 2- Docente Alan Profesor:
DNI(username): 35785659
PASS: 35785659

Rol 3- Estudiante Julio Estudiante:
DNI(username): 333111333
PASS: 333111333
