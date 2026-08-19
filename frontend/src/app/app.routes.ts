import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';
import { Home } from './views/home/home';
import { Login } from './views/login/login';

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
    }
];