import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { UserRole } from '../core/auth/auth.model';

const PANEL_POR_ROL: Record<UserRole, string> = {
  [UserRole.ADMIN]: '/dashboard-admin',
  [UserRole.DOCENTE]: '/dashboard/welcome',
  [UserRole.ESTUDIANTE]: '/dashboard/estudiante/welcome',
};

/**
 * Allows the route only for the given roles. Anyone else is redirected to their
 * own panel; without a session (or an unknown role) they go to /login.
 * Use it after `authGuard`: `canActivate: [authGuard, roleGuard([UserRole.ADMIN])]`.
 */
export const roleGuard = (roles: UserRole[]): CanActivateFn => () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  const rol = authService.rol() as UserRole | undefined;
  const panelPropio = rol === undefined ? undefined : PANEL_POR_ROL[rol];
  if (rol === undefined || !panelPropio) {
    return router.createUrlTree(['/login']);
  }

  return roles.includes(rol) ? true : router.createUrlTree([panelPropio]);
};
