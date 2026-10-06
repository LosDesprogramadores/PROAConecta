import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { UserRole } from '../core/auth/auth.model';

/**
 * Matches the route only when the logged-in user has one of the given roles.
 * Two sibling routes with the same path and different `canMatch` let one URL
 * (`view-materia/:id/calificaciones`) resolve to a different component per role.
 * Without a session or a known role it redirects to `/login`.
 */
export const rolCoincide = (roles: UserRole[]): CanMatchFn => () => {
  const authService = inject(AuthService);
  const rol = authService.rol() as UserRole | undefined;
  if (!authService.isLoggedIn() || rol === undefined) {
    // No session or no known role: send them to login instead of a 404.
    return inject(Router).createUrlTree(['/login']);
  }
  return roles.includes(rol);
};

function materiaIdDe(route: ActivatedRouteSnapshot): string | null {
  for (let actual: ActivatedRouteSnapshot | null = route; actual; actual = actual.parent) {
    const id = actual.paramMap.get('id');
    if (id) {
      return id;
    }
  }
  return null;
}

/**
 * Guards the professor's grade sheet. A student who types the URL by hand is
 * sent to their own grades view instead of the generic panel redirect.
 */
export const planillaCalificacionesGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  const rol = authService.rol() as UserRole | undefined;
  if (rol === UserRole.DOCENTE || rol === UserRole.ADMIN) {
    return true;
  }

  const materiaId = materiaIdDe(route);
  if (rol === UserRole.ESTUDIANTE && materiaId) {
    return router.createUrlTree(['/view-materia', materiaId, 'calificaciones']);
  }
  return router.createUrlTree(['/login']);
};
