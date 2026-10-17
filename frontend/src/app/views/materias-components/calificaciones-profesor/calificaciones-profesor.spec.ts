import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { FileDownloadService } from '../../../core/http/file-download';
import { environment } from '../../../../environments/environment';
import { ActividadesService } from '../../../services/actividades.service';
import { ToastService } from '../../../services/toast.service';
import { CalificacionesProfesor } from './calificaciones-profesor';

describe('CalificacionesProfesor access errors', () => {
  let fixture: ComponentFixture<CalificacionesProfesor>;
  let servicio: { getActividadesPorMateria: any };

  async function crear(status: number) {
    servicio = {
      getActividadesPorMateria: vi.fn(() => throwError(() => new HttpErrorResponse({ status }))),
    };
    await TestBed.configureTestingModule({
      imports: [CalificacionesProfesor],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActividadesService, useValue: servicio },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { parent: { snapshot: { paramMap: new Map([['id', '7']]) } } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CalificacionesProfesor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows a clear access message on 403 instead of a broken table', async () => {
    await crear(403);
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('No tiene acceso a las calificaciones de esta materia.');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('shows the same message on 404', async () => {
    await crear(404);
    expect(fixture.componentInstance.error()).toBe('No tiene acceso a las calificaciones de esta materia.');
  });

  it('keeps the generic message for other failures', async () => {
    await crear(500);
    expect(fixture.componentInstance.error()).toBe('No se pudieron cargar las calificaciones.');
  });
});

describe('CalificacionesProfesor PDF download', () => {
  let fixture: ComponentFixture<CalificacionesProfesor>;
  let descargar: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; readable_message_extraction: ReturnType<typeof vi.fn> };

  const boton = () => fixture.nativeElement.querySelector('button[aria-busy]') as HTMLButtonElement | null;

  async function crear(actividades: unknown[] = []) {
    descargar = vi.fn(() => of(undefined));
    toast = { success: vi.fn(), error: vi.fn(), readable_message_extraction: vi.fn(() => 'Mensaje legible') };
    await TestBed.configureTestingModule({
      imports: [CalificacionesProfesor],
      providers: [
        { provide: ActividadesService, useValue: { getActividadesPorMateria: vi.fn(() => of(actividades)) } },
        { provide: FileDownloadService, useValue: { descargar } },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { parent: { snapshot: { paramMap: new Map([['id', '7']]) } } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CalificacionesProfesor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows the "Descargar PDF" button and requests the course export for this subject', async () => {
    await crear();
    expect(boton()?.textContent?.trim()).toBe('Descargar PDF');

    boton()!.click();

    expect(descargar).toHaveBeenCalledWith(
      `${environment.apiUrl}materias/7/rendimiento-curso/exportar/`,
      { formato: 'pdf' },
      'calificaciones-7.pdf',
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('disables the button and sets aria-busy while the file is generated', async () => {
    await crear();
    const pendiente = new Subject<void>();
    descargar.mockReturnValue(pendiente);

    boton()!.click();
    fixture.detectChanges();

    expect(boton()!.disabled).toBe(true);
    expect(boton()!.getAttribute('aria-busy')).toBe('true');

    pendiente.next();
    pendiente.complete();
    fixture.detectChanges();
    expect(boton()!.disabled).toBe(false);
  });

  it('shows a readable error toast when the download fails', async () => {
    await crear();
    const fallo = new HttpErrorResponse({ status: 404 });
    descargar.mockReturnValue(throwError(() => fallo));

    boton()!.click();

    expect(toast.readable_message_extraction).toHaveBeenCalledWith(fallo);
    expect(toast.error).toHaveBeenCalledWith('Mensaje legible', 'No se pudo descargar el PDF');
    expect(fixture.componentInstance.descargando()).toBe(false);
  });
});
