import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { Login } from './login';

describe('Login error messages', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let auth: { login: any; solicitarRecuperacion: any };

  const fallo = (status: number, error: unknown) =>
    throwError(() => new HttpErrorResponse({ status, error }));

  beforeEach(async () => {
    auth = { login: vi.fn(), solicitarRecuperacion: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.loginForm.setValue({ dni: '10000001', password: 'x' });
  });

  it('shows the server detail when the credentials are wrong', () => {
    auth.login.mockReturnValue(fallo(400, { detail: 'DNI o contraseña incorrectos.' }));
    component.onSubmit();
    expect(component.errorMessage()).toBe('DNI o contraseña incorrectos.');
  });

  it('shows the throttle message on a 429', () => {
    auth.login.mockReturnValue(fallo(429, { detail: 'Demasiados intentos. Vuelva a intentarlo en 60 segundos.' }));
    component.onSubmit();
    expect(component.errorMessage()).toBe('Demasiados intentos. Vuelva a intentarlo en 60 segundos.');
  });

  it('falls back to a safe message when the server sends no detail', () => {
    auth.login.mockReturnValue(fallo(0, null));
    component.onSubmit();
    expect(component.errorMessage()).toContain('No se pudo conectar');
  });

  it('does not show a server error body on a 500', () => {
    auth.login.mockReturnValue(fallo(500, '<html>Traceback</html>'));
    component.onSubmit();
    expect(component.errorMessage()).not.toContain('Traceback');
  });

  it('shows the detail of the recovery request, including the throttle', () => {
    auth.solicitarRecuperacion.mockReturnValue(
      fallo(429, { detail: 'Demasiados intentos. Vuelva a intentarlo en 30 segundos.' }),
    );
    component.emailRecuperacion.set('a@b.com');
    component.enviarSolicitudRecuperacion();
    expect(component.errorRecuperacion()).toBe('Demasiados intentos. Vuelva a intentarlo en 30 segundos.');
  });

  it('opens the recovery form in an accessible modal', () => {
    component.abrirModalRecuperar();
    fixture.detectChanges();
    const dialogo = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(fixture.nativeElement.querySelector(`#${dialogo.getAttribute('aria-labelledby')}`).textContent).toContain(
      'Recuperar contraseña',
    );
  });
});
