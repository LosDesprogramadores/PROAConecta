import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';
import { Home } from './views/home/home';
import { Login } from './views/login/login';
import { DashboardLayout } from './layouts/dashboard-layout/dashboard-layout';
import { Materias } from './views/dashboard-components/materias/materias';
import { Anuncios } from './views/dashboard-components/anuncios/anuncios';
import { Contacto } from './views/dashboard-components/contacto/contacto';
import { MateriasLayout } from './layouts/materias-layout/materias-layout';
import { Portada } from './views/materias-components/portada/portada';
import { PortadaProfesor } from './views/materias-components/portada-profesor/portada-profesor';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role-guard';
import { planillaCalificacionesGuard, rolCoincide } from './guards/calificaciones-guard';
import { UserRole } from './core/auth/auth.model';
import { NotFound } from './views/not-found/not-found';
import { DashboardAdmin } from './views/admin/dashboard-admin/dashboard-admin';
import { Estudiante } from './views/admin/estudiante/estudiante';
import { AnunciosMateriaComponent } from './views/materias-components/anuncios/anuncios';
import { Material } from './views/materias-components/material/material';
import { Calificaciones } from './views/materias-components/materias-estudiante/calificaciones/calificaciones';
import { CalificacionesProfesor } from './views/materias-components/calificaciones-profesor/calificaciones-profesor';
import { Profesor } from './views/admin/profesor/profesor';
import { Materia } from './views/admin/materia/materia';
import { TablaGenerica } from './views/admin/tabla-generica/tabla-generica';
import { Notificacion } from './views/admin/notificacion/notificacion';
import { welcomeRedirectGuard } from './guards/welcome-redirect-guard';
import { Welcome } from './views/dashboard-components/estudiante-dashboard/welcome/welcome';
import { WelcomeProfesor } from './views/dashboard-components/welcome-profesor/welcome-profesor';
import { Actividades } from './views/materias-components/actividades/actividades';
import { ActividadesDashboard } from './views/dashboard-components/actividades-dashboard/actividades-dashboard';
import { ActividadForm } from './views/dashboard-components/actividad-form/actividad-form';
import { ActividadDetalleComponent } from './views/dashboard-components/actividad-detalle/actividad-detalle';
import { ActividadEntregasComponent } from './views/dashboard-components/actividad-entregas/actividad-entregas';
import { MensajesComponent } from './views/mensajes/mensajes';
import { NotificacionesComponent } from './views/notificaciones/notificaciones';
import { CambiarPassword } from './views/cambiar-password/cambiar-password';
import { RestablecerPassword } from './views/restablecer-password/restablecer-password';
import { rolRedirectGuard } from './guards/portada-redirect-guard';
import { PortadaEstudiante } from './views/materias-components/materias-estudiante/portada-estudiante/portada-estudiante';
import { MaterialEstudiante } from './views/materias-components/materias-estudiante/material-estudiante/material-estudiante';
import { ActividadEstudiante } from './views/materias-components/materias-estudiante/actividad-estudiante/actividad-estudiante';

const soloAdmin = roleGuard([UserRole.ADMIN]);
const soloProfesor = roleGuard([UserRole.DOCENTE]);
const soloEstudiante = roleGuard([UserRole.ESTUDIANTE]);

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'home', component: Home },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
  {
    path: 'login',
    component: Login,
  },
  {
    path: 'cambiar-password',
    canActivate: [authGuard],
    component: CambiarPassword,
  },
  {
    path: 'restablecer-password',
    component: RestablecerPassword,
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    component: DashboardLayout,
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
          { path: 'welcome', component: Welcome },
          { path: 'anuncios', component: Anuncios },
          { path: 'materias', component: Materias },
          { path: 'contacto', component: Contacto },
        ],
      },

      { path: 'welcome', canActivate: [soloProfesor], component: WelcomeProfesor },
      { path: 'actividades', canActivate: [soloProfesor], component: ActividadesDashboard },
      // Static segments go before ':id', otherwise 'nueva' is captured as an id.
      { path: 'actividades/nueva', canActivate: [soloProfesor], component: ActividadForm },
      { path: 'actividades/editar/:id', canActivate: [soloProfesor], component: ActividadForm },
      { path: 'actividades/:id', canActivate: [soloProfesor], component: ActividadDetalleComponent },
      { path: 'actividades/:id/entregas', canActivate: [soloProfesor], component: ActividadEntregasComponent },
      { path: 'anuncios', component: Anuncios },
      { path: 'materias', component: Materias },
      { path: 'tablaGenerica', component: TablaGenerica },
      { path: 'mensajes', component: MensajesComponent },
      { path: 'notificaciones', component: NotificacionesComponent },

      { path: '', redirectTo: 'ingreso', pathMatch: 'full' },
    ],
  },
  {
    path: 'view-materia/:id',
    component: MateriasLayout,
    canActivate: [authGuard],
    children: [

      { path: 'portada', component: Portada },
      { path: 'anuncios', component: AnunciosMateriaComponent },
      { path: 'material', component: Material },

      {
        path: 'estudiante',
        canActivate: [soloEstudiante],
        children: [
          { path: '', redirectTo: 'portada', pathMatch: 'full' },
          { path: 'portada', component: PortadaEstudiante },
          { path: 'calificaciones', component: Calificaciones },
          { path: 'material', component: MaterialEstudiante },
          { path: 'actividades', component: ActividadEstudiante },
        ]
      },

      // =========================
      // PROFESOR
      // =========================
      { path: 'portada-profesor', canActivate: [soloProfesor], component: PortadaProfesor },
      { path: 'actividades', component: Actividades },
      { path: 'actividades/:id/detalle', component: ActividadDetalleComponent },
      { path: 'actividades/nueva', canActivate: [soloProfesor], component: ActividadForm },
      { path: 'actividades/:id/editar', canActivate: [soloProfesor], component: ActividadForm },
      { path: 'actividades/:id/entregas', canActivate: [soloProfesor], component: ActividadEntregasComponent },
      { path: 'calificaciones-profesor', canActivate: [planillaCalificacionesGuard], component: CalificacionesProfesor },
      {
        path: 'alumnos',
        canActivate: [roleGuard([UserRole.DOCENTE, UserRole.ADMIN])],
        loadComponent: () => import('./views/materias-components/alumnos/alumnos').then((m) => m.Alumnos),
      },
      // One URL, one component per role: the student sees their own grades, the
      // professor and the admin see the course grade sheet.
      { path: 'calificaciones', canMatch: [rolCoincide([UserRole.ESTUDIANTE])], component: Calificaciones },
      { path: 'calificaciones', canMatch: [rolCoincide([UserRole.DOCENTE, UserRole.ADMIN])], component: CalificacionesProfesor },

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
    component: DashboardAdmin,
    children: [
      { path: '', redirectTo: 'profesores', pathMatch: 'full' },
      { path: 'estudiantes', component: Estudiante },
      { path: 'profesores', component: Profesor },
      { path: 'materias', component: Materia },
      { path: 'notificaciones', component: Notificacion },
    ],
  },
  { path: '**', component: NotFound },
];