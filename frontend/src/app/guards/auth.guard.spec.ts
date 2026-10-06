import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { authGuard } from './auth.guard';

function ejecutar(logueado: boolean) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: { isLoggedIn: () => logueado } }],
  });
  const router = TestBed.inject(Router);
  const resultado = TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  return resultado instanceof UrlTree ? router.serializeUrl(resultado) : resultado;
}

describe('authGuard', () => {
  it('allows access when there is a session', () => {
    expect(ejecutar(true)).toBe(true);
  });

  it('redirects to /login when there is no session', () => {
    expect(ejecutar(false)).toBe('/login');
  });
});
