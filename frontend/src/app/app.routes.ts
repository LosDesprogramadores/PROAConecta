import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';
import { Home } from './views/home/home';

export const routes: Routes = [
    {
        path: '',
        component: MainLayout,
        children: [
            { path: 'home', component: Home },
            { path: '', redirectTo: 'home', pathMatch: 'full' },
        ]
    }
];
