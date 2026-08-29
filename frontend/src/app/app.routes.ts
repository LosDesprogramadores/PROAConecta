import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';
import { Home } from './views/home/home';
import { Login } from './views/login/login';
import { DashboardLayout } from './layouts/dashboard-layout/dashboard-layout';
import { Materias } from './views/dashboard-components/materias/materias';
import { Anuncios } from './views/dashboard-components/anuncios/anuncios';
import { Contacto } from './views/dashboard-components/contacto/contacto';
import { Welcome } from './views/dashboard-components/welcome/welcome';
import { MateriasLayout } from './layouts/materias-layout/materias-layout';
import { Portada } from './views/materias-components/portada/portada';
import { ForoComponent } from './views/materias-components/foro/foro';
import { ForoDetalleComponent } from './views/materias-components/foro/foro-detalle/foro-detalle';
import { authGuard } from './guards/auth.guard';
import { DashboardAdmin } from './views/admin/dashboard-admin/dashboard-admin';
import { Estudiante } from './views/admin/estudiante/estudiante';
import { AnunciosMateriaComponent } from './views/materias-components/anuncios/anuncios';
import { Material } from './views/materias-components/material/material';
import { Actividades } from './views/materias-components/actividades/actividades';
import { Calificaciones } from './views/materias-components/calificaciones/calificaciones';

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
    component: DashboardLayout,
    //canActivate: [authGuard],
    children: [
      { path: 'welcome', component: Welcome },
      { path: 'anuncios', component: Anuncios },
      { path: 'materias', component: Materias },
      { path: 'contacto', component: Contacto },
      { path: '', redirectTo: 'welcome', pathMatch: 'full' },
    ],
  },
  {
    path: 'view-materia',
    component: MateriasLayout,
    //canActivate: [authGuard],
    children: [
      { path: 'portada', component: Portada },
      { path: 'anuncios', component: AnunciosMateriaComponent },
      { path: 'material', component: Material },
      { path: 'actividades', component: Actividades },
      { path: 'foro', component: ForoComponent },
      { path: 'foro/:id', component: ForoDetalleComponent },
      { path: 'calificaciones', component: Calificaciones },
      { path: '', redirectTo: 'portada', pathMatch: 'full' },
    ],
  },
  {
    path: 'dashboard-admin',
    component: DashboardAdmin,
    children: [{ path: 'admin/estudiantes', component: Estudiante }],
  },
];
