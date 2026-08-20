import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';
import { Home } from './views/home/home';
import { Login } from './views/login/login';
import { DashboardLayout } from './layouts/dashboard-layout/dashboard-layout';
import { Materias } from './views/dashboard-components/materias/materias';
import { Anuncios } from './views/dashboard-components/anuncios/anuncios';
import { Contacto } from './views/dashboard-components/contacto/contacto';
import { Welcome } from './views/dashboard-components/welcome/welcome';

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
        component: Login // Ruta independiente para el login
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
    }
];