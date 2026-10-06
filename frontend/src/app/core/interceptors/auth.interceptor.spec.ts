import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';

const api = (ruta: string) => `${environment.apiUrl}${ruta}`;

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('access_token', 'viejo');
    localStorage.setItem('refresh_token', 'refresh-1');

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  it('adds the bearer token to API requests', () => {
    http.get(api('materias/')).subscribe();

    const req = controller.expectOne(api('materias/'));
    expect(req.request.headers.get('Authorization')).toBe('Bearer viejo');
    req.flush([]);
  });

  it('does not send the token to other origins', () => {
    http.get('https://otro-sitio.test/datos').subscribe();

    const req = controller.expectOne('https://otro-sitio.test/datos');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('refreshes once and retries the original request after a 401', () => {
    let respuesta: unknown;
    http.get(api('materias/')).subscribe((r) => (respuesta = r));

    controller.expectOne(api('materias/')).flush({}, { status: 401, statusText: 'Unauthorized' });

    const refresco = controller.expectOne(api('auth/refresh/'));
    expect(refresco.request.method).toBe('POST');
    expect(refresco.request.body).toEqual({ refresh: 'refresh-1' });
    refresco.flush({ access: 'nuevo', refresh: 'refresh-2' });

    const reintento = controller.expectOne(api('materias/'));
    expect(reintento.request.headers.get('Authorization')).toBe('Bearer nuevo');
    reintento.flush([{ id: 1 }]);

    expect(respuesta).toEqual([{ id: 1 }]);
    expect(localStorage.getItem('access_token')).toBe('nuevo');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-2');
    expect(auth.token()).toBe('nuevo');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shares ONE refresh request between concurrent 401s', () => {
    const resultados: unknown[] = [];
    http.get(api('materias/')).subscribe((r) => resultados.push(r));
    http.get(api('inscripciones/')).subscribe((r) => resultados.push(r));
    http.get(api('notificaciones/')).subscribe((r) => resultados.push(r));

    for (const ruta of ['materias/', 'inscripciones/', 'notificaciones/']) {
      controller.expectOne(api(ruta)).flush({}, { status: 401, statusText: 'Unauthorized' });
    }

    controller.expectOne(api('auth/refresh/')).flush({ access: 'nuevo', refresh: 'refresh-2' });

    for (const ruta of ['materias/', 'inscripciones/', 'notificaciones/']) {
      const reintento = controller.expectOne(api(ruta));
      expect(reintento.request.headers.get('Authorization')).toBe('Bearer nuevo');
      reintento.flush(ruta);
    }
    expect(resultados.length).toBe(3);
  });

  it('retries with the current token, without refreshing again, when another request already did', () => {
    http.get(api('materias/')).subscribe();
    const lenta = controller.expectOne(api('materias/'));

    // Another request refreshes the session before the first one gets its 401
    http.get(api('inscripciones/')).subscribe();
    controller.expectOne(api('inscripciones/')).flush({}, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne(api('auth/refresh/')).flush({ access: 'nuevo', refresh: 'refresh-2' });
    controller.expectOne(api('inscripciones/')).flush([]);

    lenta.flush({}, { status: 401, statusText: 'Unauthorized' });

    const reintento = controller.expectOne(api('materias/'));
    expect(reintento.request.headers.get('Authorization')).toBe('Bearer nuevo');
    reintento.flush([]);
    controller.expectNone(api('auth/refresh/'));
  });

  it('logs out cleanly when the refresh fails', () => {
    let error: unknown;
    http.get(api('materias/')).subscribe({ error: (e) => (error = e) });

    controller.expectOne(api('materias/')).flush({}, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne(api('auth/refresh/')).flush({ detail: 'Token is blacklisted' }, { status: 401, statusText: 'Unauthorized' });

    expect(error).toBeTruthy();
    expect(auth.token()).toBeNull();
    expect(auth.currentUser()).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { motivo: 'sesion-expirada' } });
  });

  it('logs out without calling the server when there is no refresh token', () => {
    localStorage.removeItem('refresh_token');
    let error: unknown;
    http.get(api('materias/')).subscribe({ error: (e) => (error = e) });

    controller.expectOne(api('materias/')).flush({}, { status: 401, statusText: 'Unauthorized' });

    controller.expectNone(api('auth/refresh/'));
    expect(error).toBeTruthy();
    expect(auth.token()).toBeNull();
    expect(navigate).toHaveBeenCalled();
  });

  it('does not loop when the retried request is rejected again', () => {
    let error: unknown;
    http.get(api('materias/')).subscribe({ error: (e) => (error = e) });
    controller.expectOne(api('materias/')).flush({}, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne(api('auth/refresh/')).flush({ access: 'nuevo', refresh: 'refresh-2' });

    controller.expectOne(api('materias/')).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(error).toBeTruthy();
    controller.expectNone(api('auth/refresh/'));
  });

  it.each(['auth/login/', 'auth/refresh/', 'auth/logout/', 'auth/me/'])(
    'never refreshes on a 401 from %s',
    (ruta) => {
      let error: unknown;
      http.post(api(ruta), {}).subscribe({ error: (e) => (error = e) });

      controller.expectOne(api(ruta)).flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(error).toBeTruthy();
      controller.expectNone(api('auth/refresh/'));
      expect(navigate).not.toHaveBeenCalled();
    },
  );

  it('does not refresh on errors other than 401', () => {
    http.get(api('materias/')).subscribe({ error: () => undefined });

    controller.expectOne(api('materias/')).flush({}, { status: 403, statusText: 'Forbidden' });

    controller.expectNone(api('auth/refresh/'));
  });

  it('does not refresh a 401 that came from a request without session', () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    const cliente = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);

    cliente.get(api('materias/')).subscribe({ error: () => undefined });
    ctrl.expectOne(api('materias/')).flush({}, { status: 401, statusText: 'Unauthorized' });

    ctrl.expectNone(api('auth/refresh/'));
  });
});

describe('AuthService.logout', () => {
  let controller: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('access_token', 'a');
    localStorage.setItem('refresh_token', 'r');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => localStorage.clear());

  it('calls the backend logout with only the refresh token (no access needed) and then clears the local state', () => {
    auth.logout();

    const req = controller.expectOne(api('auth/logout/'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refresh: 'r' });
    // Local state is cleared right away, without waiting for the server
    expect(auth.token()).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('still clears the session when the backend logout fails', () => {
    auth.logout();

    controller.expectOne(api('auth/logout/')).flush({}, { status: 500, statusText: 'Server Error' });

    expect(auth.token()).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    controller.verify();
  });

  it('skips the backend call when there is no refresh token', () => {
    localStorage.removeItem('refresh_token');

    auth.logout();

    controller.expectNone(api('auth/logout/'));
    expect(auth.token()).toBeNull();
  });
});

describe('AuthService.cambiarPasswordPrimerIngreso', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('access_token', 'a');
    localStorage.setItem('refresh_token', 'viejo');
  });
  afterEach(() => localStorage.clear());

  it('stores the new token pair returned by the server, since the old refresh was revoked', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    const controller = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);

    auth.cambiarPasswordPrimerIngreso({ password_actual: 'x', password_nuevo: 'yyyyyyyy' }).subscribe();
    controller
      .expectOne(api('auth/cambiar-password-primer-ingreso/'))
      .flush({ mensaje: 'ok', access: 'acc-nuevo', refresh: 'ref-nuevo', debe_cambiar_password: false });

    expect(localStorage.getItem('access_token')).toBe('acc-nuevo');
    expect(localStorage.getItem('refresh_token')).toBe('ref-nuevo');
    expect(auth.token()).toBe('acc-nuevo');
    controller.verify();
  });
});
