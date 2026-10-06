import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { RestablecerPassword } from './restablecer-password';

describe('RestablecerPassword error messages', () => {
  let fixture: ComponentFixture<RestablecerPassword>;
  let component: RestablecerPassword;
  let auth: { confirmarRecuperacion: any };

  beforeEach(async () => {
    auth = { confirmarRecuperacion: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [RestablecerPassword],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map([['uid', 'u'], ['token', 't']]) } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RestablecerPassword);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.form.setValue({ password_nuevo: 'Clave-segura-1', confirmar_password: 'Clave-segura-1' });
  });

  it('shows the server detail when the link is invalid', () => {
    auth.confirmarRecuperacion.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'El enlace expiró.' } })),
    );
    component.onSubmit();
    expect(component.errorMessage()).toBe('El enlace expiró.');
  });

  it('shows the throttle message on a 429', () => {
    auth.confirmarRecuperacion.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 429, error: { detail: 'Demasiados intentos. Vuelva a intentarlo en 20 segundos.' } }),
      ),
    );
    component.onSubmit();
    expect(component.errorMessage()).toBe('Demasiados intentos. Vuelva a intentarlo en 20 segundos.');
  });

  it('uses the first field error when the password is rejected', () => {
    auth.confirmarRecuperacion.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { password_nuevo: ['La contraseña es demasiado común.'] } }),
      ),
    );
    component.onSubmit();
    expect(component.errorMessage()).toBe('La contraseña es demasiado común.');
  });

  describe('redirect timer', () => {
    afterEach(() => vi.useRealTimers());

    it('does not navigate to login if the view is destroyed before the delay', () => {
      vi.useFakeTimers();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      auth.confirmarRecuperacion.mockReturnValue(of({}));
      component.onSubmit();

      fixture.destroy();
      vi.advanceTimersByTime(3000);

      expect(navigate).not.toHaveBeenCalled();
    });

    it('navigates to login after the delay while the view is alive', () => {
      vi.useFakeTimers();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      auth.confirmarRecuperacion.mockReturnValue(of({}));
      component.onSubmit();

      vi.advanceTimersByTime(3000);

      expect(navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
