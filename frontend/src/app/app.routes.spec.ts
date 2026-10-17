import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Route, Router, RouterStateSnapshot, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { UserRole } from './core/auth/auth.model';
import { ActividadForm } from './views/dashboard-components/actividad-form/actividad-form';
import { Anuncios } from './views/dashboard-components/anuncios/anuncios';
import { NotFound } from './views/not-found/not-found';
import { Calificaciones } from './views/materias-components/materias-estudiante/calificaciones/calificaciones';
import { CalificacionesProfesor } from './views/materias-components/calificaciones-profesor/calificaciones-profesor';

/**
 * The router picks the first route that matches, so these specs assert the
 * resolution order on the real route table.
 */
describe('app routes', () => {
  /** Resolves the component a lazy route would render. */
  const cargar = async (ruta?: Route) => (ruta?.loadComponent as (() => Promise<unknown>) | undefined)?.();

  const hijosDe = (path: string) => routes.find((r) => r.path === path)?.children ?? [];

  function primeraCoincidencia(hijos: typeof routes, segmentos: string[]) {
    return hijos.find((r) => {
      const partes = (r.path ?? '').split('/');
      return partes.length === segmentos.length && partes.every((p, i) => p.startsWith(':') || p === segmentos[i]);
    });
  }

  it('resolves dashboard/actividades/nueva to the form and not to :id', async () => {
    const ruta = primeraCoincidencia(hijosDe('dashboard'), ['actividades', 'nueva']);
    expect(await cargar(ruta)).toBe(ActividadForm);
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

  it('has a single notices page: notificaciones and estudiante/anuncios redirect to dashboard/anuncios', async () => {
    const unica = hijosDe('dashboard').filter((r) => r.path === 'anuncios');
    expect(unica).toHaveLength(1);
    expect(unica[0].title).toBe('Anuncios');
    expect(await cargar(unica[0])).toBe(Anuncios);

    expect(hijosDe('dashboard').find((r) => r.path === 'notificaciones')?.redirectTo).toBe('anuncios');
    const estudiante = routes.find((r) => r.path === 'dashboard')!.children!.find((r) => r.path === 'estudiante')!;
    expect(estudiante.children!.find((r) => r.path === 'anuncios')?.redirectTo).toBe('/dashboard/anuncios');
  });

  it('keeps the wildcard last and pointed at the 404 screen', async () => {
    const ultima = routes[routes.length - 1];
    expect(ultima.path).toBe('**');
    expect(await cargar(ultima)).toBe(NotFound);
  });

  it('loads every view lazily: no route carries an eager component', () => {
    const eager: string[] = [];
    const recorrer = (lista: Route[], prefijo: string) =>
      lista.forEach((r) => {
        if (r.component) {
          eager.push(`${prefijo}/${r.path}`);
        }
        recorrer(r.children ?? [], `${prefijo}/${r.path}`);
      });
    recorrer(routes, '');
    expect(eager).toEqual([]);
  });

  it('every route with a screen declares loadComponent, and the table keeps its guards', () => {
    const hojas: Route[] = [];
    const recorrer = (lista: Route[]) =>
      lista.forEach((r) => {
        if (r.loadComponent) {
          hojas.push(r);
        }
        recorrer(r.children ?? []);
      });
    recorrer(routes);
    expect(hojas.length).toBeGreaterThanOrEqual(40);

    const sinGuardia = (padre: string) => hijosDe(padre).filter((r) => !!r.loadComponent && !r.canActivate && !r.canMatch);
    // Protected areas: the guard lives on the parent route.
    for (const padre of ['dashboard', 'view-materia/:id', 'dashboard-admin']) {
      expect(routes.find((r) => r.path === padre)?.canActivate?.length, padre).toBeGreaterThan(0);
    }
    expect(routes.find((r) => r.path === 'dashboard-admin')?.canActivate?.length).toBe(2);
    expect(sinGuardia('dashboard').map((r) => r.path)).toEqual(['anuncios', 'materias', 'tablaGenerica']);
  });

  it('keeps the route order: static segments before :id in dashboard and in view-materia', () => {
    const orden = (padre: string) => hijosDe(padre).map((r) => r.path);
    const dashboard = orden('dashboard');
    expect(dashboard.indexOf('actividades/nueva')).toBeLessThan(dashboard.indexOf('actividades/:id'));
    expect(dashboard.indexOf('actividades/editar/:id')).toBeLessThan(dashboard.indexOf('actividades/:id'));
    const materia = orden('view-materia/:id');
    expect(materia.indexOf('actividades/nueva')).toBeLessThan(materia.indexOf('actividades/:id/editar'));
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
  async function componenteQueResuelve(rol: UserRole | undefined) {
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
    return (ruta?.loadComponent as (() => Promise<unknown>) | undefined)?.();
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

  it('shows the student view (own grades and average) to a student', async () => {
    expect(await componenteQueResuelve(UserRole.ESTUDIANTE)).toBe(Calificaciones);
  });

  it('shows the grade sheet to the professor', async () => {
    expect(await componenteQueResuelve(UserRole.DOCENTE)).toBe(CalificacionesProfesor);
  });

  it('shows the grade sheet to the admin', async () => {
    expect(await componenteQueResuelve(UserRole.ADMIN)).toBe(CalificacionesProfesor);
  });

  it('resolves nothing without a known role', async () => {
    expect(await componenteQueResuelve(undefined)).toBeUndefined();
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

describe('dashboard/entregas guard (soloProfesor)', () => {
  const rutaEntregas = () => routes.find((r) => r.path === 'dashboard')!.children!.find((r) => r.path === 'entregas')!;

  function evaluar(sesion: { logueado: boolean; rol?: UserRole }): string | boolean {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn: () => sesion.logueado, rol: () => sesion.rol } },
      ],
    });
    const router = TestBed.inject(Router);
    const guardas = rutaEntregas().canActivate!;
    const resultado = TestBed.runInInjectionContext(() =>
      (guardas[0] as (r: ActivatedRouteSnapshot, s: RouterStateSnapshot) => unknown)(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
    return resultado instanceof UrlTree ? router.serializeUrl(resultado) : (resultado as boolean);
  }

  it('is protected by a guard', () => {
    expect(rutaEntregas().canActivate).toHaveLength(1);
  });

  it('lets the professor in', () => {
    expect(evaluar({ logueado: true, rol: UserRole.DOCENTE })).toBe(true);
  });

  it('sends a student to their own panel', () => {
    expect(evaluar({ logueado: true, rol: UserRole.ESTUDIANTE })).toBe('/dashboard/estudiante/welcome');
  });

  it('sends the administrator to the admin panel', () => {
    expect(evaluar({ logueado: true, rol: UserRole.ADMIN })).toBe('/dashboard-admin');
  });

  it('sends a visitor without a session to /login', () => {
    expect(evaluar({ logueado: false })).toBe('/login');
  });
});
