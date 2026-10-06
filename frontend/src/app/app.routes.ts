import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role-guard';
import { planillaCalificacionesGuard, rolCoincide } from './guards/calificaciones-guard';
import { UserRole } from './core/auth/auth.model';
import { welcomeRedirectGuard } from './guards/welcome-redirect-guard';
import { rolRedirectGuard } from './guards/portada-redirect-guard';

/**
 * Every view is lazy: its code is downloaded the first time the route is opened, so the initial
 * bundle only carries the shell. Loaders are grouped by area; guards stay eager (they are tiny and
 * must run before anything is downloaded).
 */

// Layouts
const cargarMainLayout = () => import('./layouts/main-layout/main-layout').then((m) => m.MainLayout);
const cargarDashboardLayout = () => import('./layouts/dashboard-layout/dashboard-layout').then((m) => m.DashboardLayout);
const cargarMateriasLayout = () => import('./layouts/materias-layout/materias-layout').then((m) => m.MateriasLayout);
const cargarDashboardAdmin = () => import('./views/admin/dashboard-admin/dashboard-admin').then((m) => m.DashboardAdmin);

// Public and session
const cargarHome = () => import('./views/home/home').then((m) => m.Home);
const cargarLogin = () => import('./views/login/login').then((m) => m.Login);
const cargarCambiarPassword = () => import('./views/cambiar-password/cambiar-password').then((m) => m.CambiarPassword);
const cargarRestablecerPassword = () => import('./views/restablecer-password/restablecer-password').then((m) => m.RestablecerPassword);
const cargarNotFound = () => import('./views/not-found/not-found').then((m) => m.NotFound);

// Student dashboard
const cargarWelcome = () => import('./views/dashboard-components/estudiante-dashboard/welcome/welcome').then((m) => m.Welcome);
const cargarAnuncios = () => import('./views/dashboard-components/anuncios/anuncios').then((m) => m.Anuncios);
const cargarMaterias = () => import('./views/dashboard-components/materias/materias').then((m) => m.Materias);
const cargarContacto = () => import('./views/dashboard-components/contacto/contacto').then((m) => m.Contacto);

// Professor dashboard and activities
const cargarWelcomeProfesor = () => import('./views/dashboard-components/welcome-profesor/welcome-profesor').then((m) => m.WelcomeProfesor);
const cargarActividadesDashboard = () => import('./views/dashboard-components/actividades-dashboard/actividades-dashboard').then((m) => m.ActividadesDashboard);
const cargarActividadForm = () => import('./views/dashboard-components/actividad-form/actividad-form').then((m) => m.ActividadForm);
const cargarActividadDetalleComponent = () => import('./views/dashboard-components/actividad-detalle/actividad-detalle').then((m) => m.ActividadDetalleComponent);
const cargarActividadEntregasComponent = () => import('./views/dashboard-components/actividad-entregas/actividad-entregas').then((m) => m.ActividadEntregasComponent);
const cargarTablaGenerica = () => import('./views/admin/tabla-generica/tabla-generica').then((m) => m.TablaGenerica);

// Communication
const cargarMensajesComponent = () => import('./views/mensajes/mensajes').then((m) => m.MensajesComponent);
const cargarNotificacionesComponent = () => import('./views/notificaciones/notificaciones').then((m) => m.NotificacionesComponent);

// Subject (view-materia)
const cargarPortada = () => import('./views/materias-components/portada/portada').then((m) => m.Portada);
const cargarAnunciosMateriaComponent = () => import('./views/materias-components/anuncios/anuncios').then((m) => m.AnunciosMateriaComponent);
const cargarMaterial = () => import('./views/materias-components/material/material').then((m) => m.Material);
const cargarPortadaEstudiante = () => import('./views/materias-components/materias-estudiante/portada-estudiante/portada-estudiante').then((m) => m.PortadaEstudiante);
const cargarCalificaciones = () => import('./views/materias-components/materias-estudiante/calificaciones/calificaciones').then((m) => m.Calificaciones);
const cargarMaterialEstudiante = () => import('./views/materias-components/materias-estudiante/material-estudiante/material-estudiante').then((m) => m.MaterialEstudiante);
const cargarActividadEstudiante = () => import('./views/materias-components/materias-estudiante/actividad-estudiante/actividad-estudiante').then((m) => m.ActividadEstudiante);
const cargarPortadaProfesor = () => import('./views/materias-components/portada-profesor/portada-profesor').then((m) => m.PortadaProfesor);
const cargarActividades = () => import('./views/materias-components/actividades/actividades').then((m) => m.Actividades);
const cargarCalificacionesProfesor = () => import('./views/materias-components/calificaciones-profesor/calificaciones-profesor').then((m) => m.CalificacionesProfesor);
const cargarAlumnos = () => import('./views/materias-components/alumnos/alumnos').then((m) => m.Alumnos);

// Administration
const cargarEstudiante = () => import('./views/admin/estudiante/estudiante').then((m) => m.Estudiante);
const cargarProfesor = () => import('./views/admin/profesor/profesor').then((m) => m.Profesor);
const cargarMateria = () => import('./views/admin/materia/materia').then((m) => m.Materia);
const cargarNotificacion = () => import('./views/admin/notificacion/notificacion').then((m) => m.Notificacion);

const soloAdmin = roleGuard([UserRole.ADMIN]);
const soloProfesor = roleGuard([UserRole.DOCENTE]);
const soloEstudiante = roleGuard([UserRole.ESTUDIANTE]);

export const routes: Routes = [
  {
    path: '',
    loadComponent: cargarMainLayout,
    children: [
      { path: 'home', loadComponent: cargarHome },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
  {
    path: 'login',
    loadComponent: cargarLogin,
  },
  {
    path: 'cambiar-password',
    canActivate: [authGuard],
    loadComponent: cargarCambiarPassword,
  },
  {
    path: 'restablecer-password',
    loadComponent: cargarRestablecerPassword,
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: cargarDashboardLayout,
    children: [
      {
        path: 'ingreso',
        canActivate: [welcomeRedirectGuard],
        children: [],
      },
      {
        path: 'estudiante',
        canActivate: [soloEstudiante],
        children: [
          { path: 'welcome', loadComponent: cargarWelcome },
          { path: 'anuncios', loadComponent: cargarAnuncios },
          { path: 'materias', loadComponent: cargarMaterias },
          { path: 'contacto', loadComponent: cargarContacto },
        ],
      },

      { path: 'welcome', canActivate: [soloProfesor], loadComponent: cargarWelcomeProfesor },
      { path: 'actividades', canActivate: [soloProfesor], loadComponent: cargarActividadesDashboard },
      // Static segments go before ':id', otherwise 'nueva' is captured as an id.
      { path: 'actividades/nueva', canActivate: [soloProfesor], loadComponent: cargarActividadForm },
      { path: 'actividades/editar/:id', canActivate: [soloProfesor], loadComponent: cargarActividadForm },
      { path: 'actividades/:id', canActivate: [soloProfesor], loadComponent: cargarActividadDetalleComponent },
      { path: 'actividades/:id/entregas', canActivate: [soloProfesor], loadComponent: cargarActividadEntregasComponent },
      { path: 'anuncios', loadComponent: cargarAnuncios },
      { path: 'materias', loadComponent: cargarMaterias },
      { path: 'tablaGenerica', loadComponent: cargarTablaGenerica },
      // The administrator has no private inbox (the server answers 403).
      { path: 'mensajes', canActivate: [roleGuard([UserRole.DOCENTE, UserRole.ESTUDIANTE])], loadComponent: cargarMensajesComponent },
      { path: 'notificaciones', loadComponent: cargarNotificacionesComponent },

      { path: '', redirectTo: 'ingreso', pathMatch: 'full' },
    ],
  },
  {
    path: 'view-materia/:id',
    loadComponent: cargarMateriasLayout,
    canActivate: [authGuard],
    children: [

      { path: 'portada', loadComponent: cargarPortada },
      { path: 'anuncios', loadComponent: cargarAnunciosMateriaComponent },
      { path: 'material', loadComponent: cargarMaterial },

      {
        path: 'estudiante',
        canActivate: [soloEstudiante],
        children: [
          { path: '', redirectTo: 'portada', pathMatch: 'full' },
          { path: 'portada', loadComponent: cargarPortadaEstudiante },
          { path: 'calificaciones', loadComponent: cargarCalificaciones },
          { path: 'material', loadComponent: cargarMaterialEstudiante },
          { path: 'actividades', loadComponent: cargarActividadEstudiante },
        ]
      },

      // =========================
      // PROFESOR
      // =========================
      { path: 'portada-profesor', canActivate: [soloProfesor], loadComponent: cargarPortadaProfesor },
      { path: 'actividades', loadComponent: cargarActividades },
      { path: 'actividades/:id/detalle', loadComponent: cargarActividadDetalleComponent },
      { path: 'actividades/nueva', canActivate: [soloProfesor], loadComponent: cargarActividadForm },
      { path: 'actividades/:id/editar', canActivate: [soloProfesor], loadComponent: cargarActividadForm },
      { path: 'actividades/:id/entregas', canActivate: [soloProfesor], loadComponent: cargarActividadEntregasComponent },
      { path: 'calificaciones-profesor', canActivate: [planillaCalificacionesGuard], loadComponent: cargarCalificacionesProfesor },
      {
        path: 'alumnos',
        canActivate: [roleGuard([UserRole.DOCENTE, UserRole.ADMIN])],
        loadComponent: cargarAlumnos,
      },
      // One URL, one component per role: the student sees their own grades, the
      // professor and the admin see the course grade sheet.
      { path: 'calificaciones', canMatch: [rolCoincide([UserRole.ESTUDIANTE])], loadComponent: cargarCalificaciones },
      { path: 'calificaciones', canMatch: [rolCoincide([UserRole.DOCENTE, UserRole.ADMIN])], loadComponent: cargarCalificacionesProfesor },

      {
        path: '',
        pathMatch: 'full',
        canActivate: [rolRedirectGuard],
        children: []
      },
    ],
  },
  {
    path: 'dashboard-admin',
    canActivate: [authGuard, soloAdmin],
    loadComponent: cargarDashboardAdmin,
    children: [
      { path: '', redirectTo: 'profesores', pathMatch: 'full' },
      { path: 'estudiantes', loadComponent: cargarEstudiante },
      { path: 'profesores', loadComponent: cargarProfesor },
      { path: 'materias', loadComponent: cargarMateria },
      { path: 'notificaciones', loadComponent: cargarNotificacion },
    ],
  },
  { path: '**', loadComponent: cargarNotFound },
];