import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { UserRole } from '../core/auth/auth.model';

export const welcomeRedirectGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const userRole = authService.currentUser()?.rolId;

  if (userRole === UserRole.DOCENTE) {
    return router.createUrlTree(['/dashboard/welcome-profesor']);
  }

  return router.createUrlTree(['/dashboard/estudiante/welcome']);
};