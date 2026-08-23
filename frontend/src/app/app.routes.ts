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
        children: [
            { path: 'portada', component: Portada },
            { path: 'foro', component: ForoComponent },
            // 2. Agregás la ruta del detalle del foro con parámetro dinámico :id
            { path: 'foro/:id', component: ForoDetalleComponent },
            { path: '', redirectTo: 'portada', pathMatch: 'full' }
        ]
    }
];