import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { UserRole } from '../../../../core/auth/auth.model';
import { FileDownloadService } from '../../../../core/http/file-download';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../services/toast.service';
import { Calificaciones } from './calificaciones';

describe('Calificaciones', () => {
  let component: Calificaciones;
  let fixture: ComponentFixture<Calificaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Calificaciones],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Calificaciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Calificaciones boletin download', () => {
  let fixture: ComponentFixture<Calificaciones>;
  let descargar: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; readable_message_extraction: ReturnType<typeof vi.fn> };

  const boton = () => fixture.nativeElement.querySelector('button[aria-busy]') as HTMLButtonElement;

  beforeEach(async () => {
    descargar = vi.fn(() => of(undefined));
    toast = { success: vi.fn(), error: vi.fn(), readable_message_extraction: vi.fn(() => 'Mensaje legible') };
    await TestBed.configureTestingModule({
      imports: [Calificaciones],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser: () => ({ rolId: UserRole.ESTUDIANTE }) } },
        { provide: FileDownloadService, useValue: { descargar } },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Calificaciones);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows the "Descargar boletin" button and requests the boletin export', () => {
    expect(boton().textContent?.trim()).toBe('Descargar boletín');

    boton().click();

    expect(descargar).toHaveBeenCalledWith(`${environment.apiUrl}materias/mi-boletin/exportar/`, {}, 'boletin.pdf');
    expect(toast.success).toHaveBeenCalled();
  });

  it('disables the button and sets aria-busy while the file is generated', () => {
    const pendiente = new Subject<void>();
    descargar.mockReturnValue(pendiente);

    boton().click();
    fixture.detectChanges();
    expect(boton().disabled).toBe(true);
    expect(boton().getAttribute('aria-busy')).toBe('true');

    pendiente.next();
    pendiente.complete();
    fixture.detectChanges();
    expect(boton().disabled).toBe(false);
  });

  it('shows a readable error toast when the download fails', () => {
    const fallo = new Error('boom');
    descargar.mockReturnValue(throwError(() => fallo));

    boton().click();

    expect(toast.readable_message_extraction).toHaveBeenCalledWith(fallo);
    expect(toast.error).toHaveBeenCalledWith('Mensaje legible', 'No se pudo descargar el boletín');
    expect(fixture.componentInstance.descargando()).toBe(false);
  });
});
