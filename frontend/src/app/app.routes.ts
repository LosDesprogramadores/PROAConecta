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
import { ForoDetalleComponent } from './views/materias-components/foro-detalle/foro-detalle';
import { authGuard } from './guards/auth.guard';
import { DashboardAdmin } from './views/admin/dashboard-admin/dashboard-admin';
import { Estudiante } from './views/admin/estudiante/estudiante';
import { AnunciosMateriaComponent } from './views/materias-components/anuncios/anuncios';
import { Profesor } from './views/admin/profesor/profesor';
import { Materia } from './views/admin/materia/materia';


export const routes: Routes = [
    {
        path: '',
        component: MainLayout,
        children: [
            { path: 'home', component: Home },
            { path: '', redirectTo: 'home', pathMatch: 'full' },
        ]
    },
    {
        path: 'login',
        component: Login
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
            { path: '', redirectTo: 'welcome', pathMatch: 'full' }
        ]
    },
    {
        path: 'view-materia',
        component: MateriasLayout,
        //canActivate: [authGuard],
        children: [
            { path: 'portada', component: Portada },
            { path: 'foro', component: ForoComponent },
            { path: 'anuncios', component: AnunciosMateriaComponent },
            { path: 'foro/:id', component: ForoDetalleComponent },
            { path: '', redirectTo: 'portada', pathMatch: 'full' }
        ]
    },

    {
    path: 'dashboard-admin',
    component : DashboardAdmin,
    children : [
        { path: '', redirectTo: 'admin/profesores', pathMatch: 'full' },
        {path: 'admin/estudiantes', component: Estudiante},
        {path: 'admin/profesores', component: Profesor},
        {path: 'admin/materias', component: Materia}    ]
    }
];