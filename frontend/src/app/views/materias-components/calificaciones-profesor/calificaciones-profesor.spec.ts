import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActividadesService } from '../../../services/actividades.service';
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
