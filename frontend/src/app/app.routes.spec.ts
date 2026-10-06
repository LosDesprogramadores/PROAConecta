import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Route, Router, RouterStateSnapshot, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { UserRole } from './core/auth/auth.model';
import { ActividadForm } from './views/dashboard-components/actividad-form/actividad-form';
import { NotFound } from './views/not-found/not-found';
import { Calificaciones } from './views/materias-components/materias-estudiante/calificaciones/calificaciones';
import { CalificacionesProfesor } from './views/materias-components/calificaciones-profesor/calificaciones-profesor';

/**
 * The router picks the first route that matches, so these specs assert the
 * resolution order on the real route table.
 */
describe('app routes', () => {
  const hijosDe = (path: string) => routes.find((r) => r.path === path)?.children ?? [];

  function primeraCoincidencia(hijos: typeof routes, segmentos: string[]) {
    return hijos.find((r) => {
      const partes = (r.path ?? '').split('/');
      return partes.length === segmentos.length && partes.every((p, i) => p.startsWith(':') || p === segmentos[i]);
    });
  }

  it('resolves dashboard/actividades/nueva to the form and not to :id', () => {
    const ruta = primeraCoincidencia(hijosDe('dashboard'), ['actividades', 'nueva']);
    expect(ruta?.component).toBe(ActividadForm);
  });

  it('keeps the administrator out of the private inbox (dashboard/mensajes)', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn: () => true, rol: () => UserRole.ADMIN } },
      ],
    });
    const router = TestBed.inject(Router);
    const ruta = primeraCoincidencia(hijosDe('dashboard'), ['mensajes'])!;
    const resultado = TestBed.runInInjectionContext(() =>
      (ruta.canActivate![0] as (r: ActivatedRouteSnapshot, s: RouterStateSnapshot) => unknown)(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
    expect(resultado).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/dashboard-admin');
  });

  it('keeps the wildcard last and pointed at the 404 screen', () => {
    const ultima = routes[routes.length - 1];
    expect(ultima.path).toBe('**');
    expect(ultima.component).toBe(NotFound);
  });
});

describe('view-materia/:id/calificaciones by role', () => {
  const hijos = routes.find((r) => r.path === 'view-materia/:id')?.children ?? [];

  function configurar(sesion: { logueado: boolean; rol?: UserRole }) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn: () => sesion.logueado, rol: () => sesion.rol } },
      ],
    });
  }

  /** Component of the first `calificaciones` route whose canMatch accepts the role. */
  function componenteQueResuelve(rol: UserRole | undefined) {
    configurar({ logueado: rol !== undefined, rol });
    const segmentos = [new UrlSegment('calificaciones', {})];
    const ruta = hijos.find(
      (r: Route) =>
        r.path === 'calificaciones' &&
        (r.canMatch ?? []).every(
          (guard) =>
            TestBed.runInInjectionContext(() => (guard as (r: Route, s: UrlSegment[]) => unknown)(r, segmentos)) === true,
        ),
    );
    return ruta?.component;
  }

  function planillaProfesor(sesion: { logueado: boolean; rol?: UserRole }) {
    configurar(sesion);
    const ruta = hijos.find((r) => r.path === 'calificaciones-profesor');
    const router = TestBed.inject(Router);
    const padre = { paramMap: { get: (k: string) => (k === 'id' ? '7' : null) }, parent: null };
    const snapshot = { paramMap: { get: () => null }, parent: padre } as unknown as ActivatedRouteSnapshot;
    const resultado = TestBed.runInInjectionContext(() =>
      (ruta!.canActivate as any[])[0](snapshot, {} as RouterStateSnapshot),
    );
    return resultado instanceof UrlTree ? router.serializeUrl(resultado) : resultado;
  }

  it('shows the student view (own grades and average) to a student', () => {
    expect(componenteQueResuelve(UserRole.ESTUDIANTE)).toBe(Calificaciones);
  });

  it('shows the grade sheet to the professor', () => {
    expect(componenteQueResuelve(UserRole.DOCENTE)).toBe(CalificacionesProfesor);
  });

  it('shows the grade sheet to the admin', () => {
    expect(componenteQueResuelve(UserRole.ADMIN)).toBe(CalificacionesProfesor);
  });

  it('resolves nothing without a known role', () => {
    expect(componenteQueResuelve(undefined)).toBeUndefined();
  });

  it('redirects to /login instead of the 404 when there is no session or role', () => {
    configurar({ logueado: false });
    const router = TestBed.inject(Router);
    const ruta = hijos.find((r) => r.path === 'calificaciones')!;
    const resultado = TestBed.runInInjectionContext(() =>
      (ruta.canMatch![0] as (r: Route, s: UrlSegment[]) => unknown)(ruta, []),
    );
    expect(resultado).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/login');
  });

  it('lets the professor open calificaciones-profesor', () => {
    expect(planillaProfesor({ logueado: true, rol: UserRole.DOCENTE })).toBe(true);
  });

  it('lets the admin open calificaciones-profesor', () => {
    expect(planillaProfesor({ logueado: true, rol: UserRole.ADMIN })).toBe(true);
  });

  it('redirects a student who types calificaciones-profesor to their own view', () => {
    expect(planillaProfesor({ logueado: true, rol: UserRole.ESTUDIANTE })).toBe('/view-materia/7/calificaciones');
  });

  it('redirects to /login without a session', () => {
    expect(planillaProfesor({ logueado: false })).toBe('/login');
  });
});
