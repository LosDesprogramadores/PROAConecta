import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { UserRole } from '../core/auth/auth.model';
import { roleGuard } from './role-guard';

function ejecutar(roles: UserRole[], sesion: { logueado: boolean; rol?: UserRole }) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { isLoggedIn: () => sesion.logueado, rol: () => sesion.rol } },
    ],
  });
  const router = TestBed.inject(Router);
  const resultado = TestBed.runInInjectionContext(() =>
    roleGuard(roles)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  return resultado instanceof UrlTree ? router.serializeUrl(resultado) : resultado;
}

describe('roleGuard', () => {
  it('allows a user whose role is in the list', () => {
    expect(ejecutar([UserRole.DOCENTE], { logueado: true, rol: UserRole.DOCENTE })).toBe(true);
  });

  it('allows any of several roles', () => {
    expect(ejecutar([UserRole.DOCENTE, UserRole.ADMIN], { logueado: true, rol: UserRole.ADMIN })).toBe(true);
  });

  it('redirects to /login when there is no session', () => {
    expect(ejecutar([UserRole.ADMIN], { logueado: false })).toBe('/login');
  });

  it('redirects to /login when the session has no known role', () => {
    expect(ejecutar([UserRole.ADMIN], { logueado: true, rol: undefined })).toBe('/login');
  });

  it('sends a student to the student panel', () => {
    expect(ejecutar([UserRole.ADMIN], { logueado: true, rol: UserRole.ESTUDIANTE })).toBe(
      '/dashboard/estudiante/welcome',
    );
  });

  it('sends a professor to the professor panel', () => {
    expect(ejecutar([UserRole.ADMIN], { logueado: true, rol: UserRole.DOCENTE })).toBe('/dashboard/welcome');
  });

  it('sends an admin to the admin panel', () => {
    expect(ejecutar([UserRole.ESTUDIANTE], { logueado: true, rol: UserRole.ADMIN })).toBe('/dashboard-admin');
  });
});
