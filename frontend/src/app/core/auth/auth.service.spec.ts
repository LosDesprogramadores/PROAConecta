import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { UserRole } from './auth.model';
import { AuthService } from './auth.service';

const api = (ruta: string) => `${environment.apiUrl}${ruta}`;

const perfil = {
  id: 7,
  userName: '30111222',
  rolId: UserRole.DOCENTE,
  persona: { id: 3, nombre: 'Ana', apellido: 'Paz' },
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  function crear(): void {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('starts without a session when storage is empty', () => {
    crear();

    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.rol()).toBeUndefined();
  });

  it('restores the session from storage', () => {
    localStorage.setItem('access_token', 'a');
    localStorage.setItem('current_user', JSON.stringify(perfil));
    crear();

    expect(service.isLoggedIn()).toBe(true);
    expect(service.rol()).toBe(UserRole.DOCENTE);
    expect(service.currentPersona()?.nombre).toBe('Ana');
  });

  it('posts the credentials, stores both tokens and loads the profile with the new access token', () => {
    crear();
    let usuario: unknown;
    service.login({ dni: '30111222', password: 'secreta' }).subscribe((u) => (usuario = u));

    const login = http.expectOne(api('auth/login/'));
    expect(login.request.method).toBe('POST');
    expect(login.request.body).toEqual({ dni: '30111222', password: 'secreta' });
    login.flush({ access: 'acc', refresh: 'ref', debe_cambiar_password: true });

    const me = http.expectOne(api('auth/me/'));
    expect(me.request.method).toBe('GET');
    expect(me.request.headers.get('Authorization')).toBe('Bearer acc');
    me.flush(perfil);

    expect(localStorage.getItem('access_token')).toBe('acc');
    expect(localStorage.getItem('refresh_token')).toBe('ref');
    expect(service.token()).toBe('acc');
    expect(service.rol()).toBe(UserRole.DOCENTE);
    expect(usuario).toMatchObject({ id: 7, debe_cambiar_password: true });
  });

  it('does not store a session when the login is rejected', () => {
    crear();
    let error: unknown;
    service.login({ dni: '1', password: 'x' }).subscribe({ error: (e) => (error = e) });

    http.expectOne(api('auth/login/')).flush({ detail: 'DNI o contraseña incorrectos.' }, { status: 400, statusText: 'Bad Request' });

    expect(error).toBeTruthy();
    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('changes the first-login password with the current token', () => {
    localStorage.setItem('access_token', 'acc');
    crear();

    service.cambiarPasswordPrimerIngreso({ password_actual: 'a', password_nuevo: 'bbbbbbbb' }).subscribe();

    const req = http.expectOne(api('auth/cambiar-password-primer-ingreso/'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ password_actual: 'a', password_nuevo: 'bbbbbbbb' });
    expect(req.request.headers.get('Authorization')).toBe('Bearer acc');
    req.flush({});
  });

  it('requests a password recovery by email', () => {
    crear();

    service.solicitarRecuperacion('ana@ejemplo.test').subscribe();

    const req = http.expectOne(api('auth/solicitar-recuperacion/'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'ana@ejemplo.test' });
    req.flush({});
  });

  it('confirms the recovery with uid, token and the new password', () => {
    crear();

    service.confirmarRecuperacion({ uid: 'u', token: 't', password_nuevo: 'bbbbbbbb' }).subscribe();

    const req = http.expectOne(api('auth/confirmar-recuperacion/'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ uid: 'u', token: 't', password_nuevo: 'bbbbbbbb' });
    req.flush({});
  });

  it('shares a single refresh request between concurrent callers and stores the rotated tokens', () => {
    localStorage.setItem('access_token', 'viejo');
    localStorage.setItem('refresh_token', 'r1');
    crear();
    const nuevos: string[] = [];

    service.refrescarToken().subscribe((t) => nuevos.push(t));
    service.refrescarToken().subscribe((t) => nuevos.push(t));

    const req = http.expectOne(api('auth/refresh/'));
    expect(req.request.body).toEqual({ refresh: 'r1' });
    req.flush({ access: 'nuevo', refresh: 'r2' });

    expect(nuevos).toEqual(['nuevo', 'nuevo']);
    expect(localStorage.getItem('refresh_token')).toBe('r2');
    expect(service.token()).toBe('nuevo');

    // Once finished, a later refresh makes a new request
    service.refrescarToken().subscribe();
    http.expectOne(api('auth/refresh/')).flush({ access: 'otro' });
  });

  it('fails the refresh without a request when there is no refresh token', () => {
    crear();
    let error: unknown;

    service.refrescarToken().subscribe({ error: (e) => (error = e) });

    expect(error).toBeTruthy();
    http.expectNone(api('auth/refresh/'));
  });
});
