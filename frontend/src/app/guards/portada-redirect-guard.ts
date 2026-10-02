import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { UserRole } from '../core/auth/auth.model';

export const rolRedirectGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const userRole = authService.currentUser()?.rolId;
    const materiaId = route.parent?.paramMap.get('id');

    if (!materiaId) {
        return router.createUrlTree(['/dashboard']);
    }

    if (userRole === UserRole.DOCENTE) {
        return router.createUrlTree(['/view-materia', materiaId, 'portada-profesor']);
    }

    return router.createUrlTree(['/view-materia', materiaId, 'estudiante', 'portada']);
};