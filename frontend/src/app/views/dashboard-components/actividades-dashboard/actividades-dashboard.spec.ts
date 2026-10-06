import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Actividad } from '../../../model/actividad-model';
import { ActividadesService } from '../../../services/actividades.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { ToastService } from '../../../services/toast.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActividadesDashboard } from './actividades-dashboard';

describe('ActividadesDashboard', () => {
  let component: ActividadesDashboard;
  let fixture: ComponentFixture<ActividadesDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActividadesDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActividadesDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows an error toast when deleting an activity fails', () => {
    vi.spyOn(TestBed.inject(ConfirmDialogService), 'confirmar').mockReturnValue(of(true));
    vi.spyOn(TestBed.inject(ActividadesService), 'eliminarActividad').mockReturnValue(throwError(() => new Error('boom')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = vi.spyOn(TestBed.inject(ToastService), 'error').mockImplementation(() => undefined);

    component.eliminarActividad({ id: 1, titulo: 'T', materia: 1 } as Actividad);

    expect(error).toHaveBeenCalledWith('No se pudo eliminar la actividad. Intenta nuevamente.');
  });
});
