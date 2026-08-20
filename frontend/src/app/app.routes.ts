import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';
import { Home } from './views/home/home';
import { Login } from './views/login/login';
import { DashboardLayout } from './layouts/dashboard-layout/dashboard-layout';
import { Materias } from './views/dashboard-components/materias/materias';
import { Anuncios } from './views/dashboard-components/anuncios/anuncios';

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
            { path: '', component: Home },
            { path: 'anuncios', component: Anuncios },
            { path: 'materias', component: Materias },
            { path: '', redirectTo: '', pathMatch: 'full' }
        ]
    }
];