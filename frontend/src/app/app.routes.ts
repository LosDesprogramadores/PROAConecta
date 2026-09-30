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
import { ForoComponent } from './views/materias-components/foro/foro';
import { ForoDetalleComponent } from './views/materias-components/foro/foro-detalle/foro-detalle';
import { authGuard } from './guards/auth.guard';
import { DashboardAdmin } from './views/admin/dashboard-admin/dashboard-admin';
import { Estudiante } from './views/admin/estudiante/estudiante';
import { AnunciosMateriaComponent } from './views/materias-components/anuncios/anuncios';
import { Material } from './views/materias-components/material/material';
import { Calificaciones } from './views/materias-components/calificaciones/calificaciones';
import { Profesor } from './views/admin/profesor/profesor';
import { Materia } from './views/admin/materia/materia';
import { TablaGenerica } from './views/admin/tabla-generica/tabla-generica';
import { Notificacion } from './views/admin/notificacion/notificacion';
import { welcomeRedirectGuard } from './guards/welcome-redirect-guard';
import { Welcome } from './views/dashboard-components/estudiante-inicio/welcome/welcome';
import { WelcomeProfesor } from './views/dashboard-components/welcome-profesor/welcome-profesor';
import { Actividades } from './views/materias-components/actividades/actividades';
import { ActividadesDashboard } from './views/dashboard-components/actividades-dashboard/actividades-dashboard';
import { ActividadForm } from './views/dashboard-components/actividad-form/actividad-form';
import { ActividadDetalleComponent } from './views/dashboard-components/actividad-detalle/actividad-detalle';
import { ActividadEntregasComponent } from './views/dashboard-components/actividad-entregas/actividad-entregas';
import { MensajesComponent } from './views/mensajes/mensajes';
import { NotificacionesComponent } from './views/notificaciones/notificaciones';

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
    path: 'dashboard',
    canActivate: [authGuard],
    component: DashboardLayout,
    children: [
      {
        path: 'ingreso',
        canActivate: [welcomeRedirectGuard],
        children: []
      },
      {
        path: 'estudiante',
        children: [
          { path: 'welcome', component: Welcome },
          { path: 'anuncios', component: Anuncios },
          { path: 'materias', component: Materias },
          { path: 'contacto', component: Contacto },
        ]
      },

      { path: 'welcome', component: WelcomeProfesor },
      { path: 'actividades', component: ActividadesDashboard },
      { path: 'actividades/nueva', component: ActividadForm },
      { path: 'actividades/editar/:id', component: ActividadForm },
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
      { path: 'portada-profesor', component: PortadaProfesor },
      { path: 'anuncios', component: AnunciosMateriaComponent },
      { path: 'material', component: Material },
      { path: 'actividades', component: Actividades },
      { path: 'actividades/nueva', component: ActividadForm },
      { path: 'actividades/:id/detalle', component: ActividadDetalleComponent }, // 👈 Vista de sólo lectura ("Ver")
      { path: 'actividades/:id/editar', component: ActividadForm },             // 👈 Formulario editable ("Editar")
      { path: 'actividades/:id/entregar', component: ActividadForm },           // 👈 Vista de entrega alumno
      { path: 'actividades/:id/entregas', component: ActividadEntregasComponent }, // 👈 Panel de entregas profesor
      { path: 'foro', component: ForoComponent },
      { path: 'foro/:id', component: ForoDetalleComponent },
      { path: 'calificaciones', component: Calificaciones },
      { path: '', redirectTo: 'portada', pathMatch: 'full' },
    ],
  },
  {
    path: 'dashboard-admin',
    component: DashboardAdmin,
    children: [
      { path: '', redirectTo: 'profesores', pathMatch: 'full' },
      { path: 'estudiantes', component: Estudiante },
      { path: 'profesores', component: Profesor },
      { path: 'materias', component: Materia },
      { path: 'notificaciones', component: Notificacion }
    ]
  }
];