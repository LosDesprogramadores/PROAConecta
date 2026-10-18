# PROA Conecta 🚀

> **Evidencia de Aprendizaje: Sprint 4**
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

**PROA Conecta** es una aplicación web Full Stack integral orientada a la gestión académica, aula virtual e institucional de la escuela **PROA Embalse**. Centraliza la gestión de usuarios, roles, cursos, materias, actividades, envíos, archivos, avisos y notificaciones en tiempo real en una única plataforma unificada.

El sistema emplea una **arquitectura cliente-servidor desacoplada**, separando la aplicación cliente de los servicios backend REST y WebSocket. El backend está estructurado en aplicaciones modulares, mientras que el frontend se basa en componentes independientes y patrones reactivos.

---

## 🚀 Novedades y Logros del Sprint 4

Durante el **Sprint 4**, el ecosistema evolucionó hacia una versión robusta y lista para producción:

- **Seguridad y Accesos:** Autorización centralizada, revocación de tokens JWT, límite de intentos en login por DNI y recuperación de contraseñas mediante correos transaccionales en segundo plano (Brevo API).
- **Interactividad en Tiempo Real:** Canales WebSocket autenticados mediante tickets de un solo uso para mensajería y notificaciones instantáneas segmentadas por grupos.
- **Exportación Segura de Datos:** Motor de exportación de reportes en **PDF** (ReportLab con fuentes integradas) y **CSV** con protección OWASP contra inyección de fórmulas.
- **Auditoría e Integridad:** Registro en bitácora (MongoDB) de eventos de dominio, y validación estricta en la carga y descarga de archivos protegidos.
- **Calidad Continua (CI/CD):** Pipeline automatizado (GitHub Actions) con validaciones de código, escaneo de secretos (Gitleaks), y **pruebas End-to-End (E2E) con Playwright**.
- **Despliegue en la Nube:** Migración de la infraestructura a **Render**, operando en conjunto con nuestra arquitectura de contenedores.

---

## 🏗️ Arquitectura de Dominio y Backend (Django & DRF)

El backend impone patrones consistentes de seguridad, control de acceso basado en roles (RBAC) y aislamiento de datos.

### Identidad, Autenticación y Seguridad (`usuario`)
- **Login por DNI y Throttling:** Autenticación personalizada utilizando el DNI en lugar del nombre de usuario. Para evitar fuerza bruta, los intentos de login aplican *throttling* hasheando el DNI con SHA-256 antes de guardarlo en caché.
- **Flujo de Primer Ingreso:** Las cuentas nuevas se marcan obligando al usuario a cambiar la contraseña temporal generada por el sistema.
- **Correos Transaccionales (Brevo):** Despacho asíncrono de credenciales y enlaces de recuperación. Si el correo falla, se envía una alerta urgente por MongoDB al administrador.

### Núcleo Académico y Aula Virtual (`academico` & `aula_virtual`)
- **Gestión Académica:** Inscripción transaccional por lotes (con límites de seguridad de 200 alumnos por lote).
- **Visibilidad Basada en Roles:** Acceso total para administradores (incluyendo "papelera" de registros eliminados), acceso restringido a materias asignadas para docentes, y visibilidad estricta de cursado para estudiantes.
- **Descargas Protegidas:** Los archivos se sirven a través de rutas relativas autenticadas por JWT, evitando exposición pública de URLs.

### Tiempo Real, Mensajería y Notificaciones (MongoDB & WebSockets)
- **Autenticación de WebSockets (`Ticket WS`):** Se implementó un sistema de tickets de un solo uso de corta duración emitidos vía REST para autorizar la conexión a Django Channels y Redis.
- **Mensajería Aislada:** Comunicación directa privada entre un Docente y sus Estudiantes. Incluye una ventana estricta de eliminación lógica de 15 minutos para mensajes enviados y sincronización reactiva de contadores de "no leídos".
- **Administración de Notificaciones:** Motor de avisos globales o por materia con soporte para **notificaciones programadas**. El sistema evalúa dinámicamente si una notificación está *vigente*, *vencida* o *programada* en base a la zona horaria local.
- **Bitácora (Auditoría):** Todo evento crítico se asienta en MongoDB, indexada por actor, entidad y fecha, inspeccionable por administradores.

---

## 🎨 Arquitectura Frontend (Angular 21)

La aplicación cliente (SPA) está optimizada para cargas rápidas, reactividad instantánea y enrutamiento seguro.

- **Manejo de Estado con Señales:** Adopción profunda de Angular Signals (`signal`, `computed`) para el estado reactivo en `AuthService`, `MensajesEstadoService` (sincronización optimista de contadores) y `ToastService`.
- **Enrutamiento y Carga Diferida:** Estructurado bajo `MainLayout` (público), `DashboardLayout` (paneles) y `MateriasLayout` (`/view-materia/:id`).
- **Formularios Dinámicos y Cascada:** Uso de `NonNullableFormBuilder` con selectores en cascada (ej. seleccionar una materia habilita dinámicamente la lista de destinatarios permitidos).
- **Guardianes de Seguridad (Guards):** `authGuard`, `roleGuard`, y `welcomeRedirectGuard` controlan el acceso evitando la escalada de privilegios.

---

## ⚙️ Infraestructura, Docker y CI/CD

El ecosistema está completamente automatizado, desde el desarrollo local hasta la validación en la nube.

### Contenedorización y Proxy Inverso (Nginx)
- **Multi-stage Build:** El frontend utiliza un `Dockerfile` en dos etapas (compilación en Node.js y servido estático en Alpine Nginx).
- **Enrutamiento Nginx (`nginx.conf`):** Configurado como proxy inverso, redirige el tráfico API (`/api/`) a Django, el tráfico de WebSockets (`/ws/`) a Channels, bloquea el acceso directo a la carpeta `/media/` y maneja el *fallback* del enrutador SPA de Angular (`index.html`).

### Orquestación Local y Pruebas de Humo
- **Docker Compose:** Orquesta 6 servicios integrados: `db` (PostgreSQL), `mongo` (MongoDB), `redis`, `backend` (Django), `programador` (cron de notificaciones) y `frontend` (Nginx).
- **Scripts Operativos (`scripts/`):** Utilidades Bash para backups consistentes (`pg_dump` y `mongodump`), parseo seguro de URLs, y un riguroso test de humo (`smoke-compose.sh`) que verifica el handshake de WebSockets.

### Pipeline de Integración Continua (GitHub Actions)
Definido en `ci.yml`, ejecuta paralelamente:
- **Backend:** `pytest` con bases de datos en memoria, análisis estático con `Ruff` y auditoría de vulnerabilidades con `pip-audit`.
- **Frontend:** `Vitest` para pruebas de componentes aislados, validación de linting con `ESLint` y auditoría de NPM.
- **E2E (Playwright):** Levanta un entorno Docker aislado (`docker-compose.e2e.yml`) con **Mailpit** para interceptar correos. Ejecuta flujos críticos (login, bloqueo por intentos, envío de mensajes, corrección de entregas, descarga de boletines en PDF).
- **Seguridad:** Escaneo de secretos histórico y diferencial mediante `Gitleaks` y gestión automática de dependencias con `Dependabot`.

---

## 📖 Glosario de Términos (Dominio Core)

Para facilitar la comprensión del código y las reglas de negocio, se definen los siguientes términos:

- **Persona / Usuario:** `Persona` almacena datos reales e identificatorios (DNI, Nombre). `Usuario` maneja las credenciales y el estado de la sesión.
- **DNI:** Documento Nacional de Identidad, utilizado como identificador principal (username) para el login.
- **Soft Delete / fecha_baja:** Patrón de eliminación lógica. Los registros críticos no se borran de la base de datos (SQL DELETE), sino que se les asigna una fecha en el campo `fecha_baja`.
- **Papelera:** Estado de los registros que poseen `fecha_baja`. Los administradores pueden visualizar estos registros enviando el parámetro `papelera=true`.
- **Inscripción:** Entidad que vincula a un estudiante con una materia, controlando su estado académico (*Cursando, Regular, Promocionado, Libre, Baja*).
- **Ticket WS:** Token de un solo uso y corta duración generado vía API REST para autenticar de manera segura las conexiones de WebSockets en el frontend sin exponer el JWT en la URL.
- **Bitácora:** Registro inmutable almacenado en MongoDB que actúa como log de auditoría para rastrear todas las acciones críticas realizadas por los usuarios en el sistema.
- **Seguimiento:** Tablero de control que agrupa a todos los alumnos de una materia y su estado en las distintas actividades (Entregado, Pendiente, No Entregado, Fuera de Término, Corregido).

---

## 🚀 Empezar y Desarrollo Local

**Prerrequisitos:**
- [Git CLI](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 

### 1. Clonar el repositorio y configurar el entorno

```bash
git clone [https://github.com/LosDesprogramadores/PROAConecta](https://github.com/LosDesprogramadores/PROAConecta)
cd PROAConecta
cd backend/.env.example backend/.env
Copiar contenido del env enviado a la catedra
```

### 2. Levantar la infraestructura

```bash
docker compose up -d --build --wait
```

### 3. Accesos Locales

- **Frontend:** `http://localhost:4200`
- **Backend API:** `http://localhost:8000/api/`
- **Mailpit (Catcher de correos locales):** `http://localhost:8025/` *(si se usa la pila E2E)*

Las credenciales de prueba utilizan el **DNI** como usuario y la contraseña de `12345678` para cualquier usuario:
- **Administrador:** 10000001
- **Profesor:** 20000001
- **Estudiante:** 30000001
