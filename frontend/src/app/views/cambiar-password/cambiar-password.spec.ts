import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { CambiarPassword } from './cambiar-password';

describe('CambiarPassword error messages', () => {
  let fixture: ComponentFixture<CambiarPassword>;
  let component: CambiarPassword;
  let auth: { cambiarPasswordPrimerIngreso: any; currentUser: any; logout: any };

  beforeEach(async () => {
    auth = { cambiarPasswordPrimerIngreso: vi.fn(), currentUser: vi.fn(), logout: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [CambiarPassword],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(CambiarPassword);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.form.setValue({
      password_actual: 'vieja',
      password_nuevo: 'Clave-segura-1',
      confirmar_password: 'Clave-segura-1',
    });
  });

  it('shows the server detail when the current password is wrong', () => {
    auth.cambiarPasswordPrimerIngreso.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'La contraseña actual es incorrecta.' } })),
    );
    component.onSubmit();
    expect(component.errorMessage()).toBe('La contraseña actual es incorrecta.');
  });

  it('shows the throttle message on a 429', () => {
    auth.cambiarPasswordPrimerIngreso.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 429, error: { detail: 'Demasiados intentos. Vuelva a intentarlo en 10 segundos.' } }),
      ),
    );
    component.onSubmit();
    expect(component.errorMessage()).toBe('Demasiados intentos. Vuelva a intentarlo en 10 segundos.');
  });

  it('keeps a safe message when the server answers with no body', () => {
    auth.cambiarPasswordPrimerIngreso.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    component.onSubmit();
    expect(component.errorMessage()).toContain('No se pudo conectar');
  });
});
