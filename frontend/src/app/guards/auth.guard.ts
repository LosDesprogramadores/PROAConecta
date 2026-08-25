import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ServiceAuth } from '../services/service.auth';

export const authGuard: CanActivateFn = () => {

    const authService = inject(ServiceAuth);
    const router = inject(Router);

    if (authService.isLoggedIn()) {
        return true;
    }

    return router.createUrlTree(['/login']);
};