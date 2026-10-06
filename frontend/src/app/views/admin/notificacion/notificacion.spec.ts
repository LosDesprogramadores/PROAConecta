import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificacionService } from '../../../services/notificaciones.service';
import { Notificacion } from './notificacion';

describe('Notificacion (admin)', () => {
  let component: Notificacion;
  let fixture: ComponentFixture<Notificacion>;
  let servicio: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    servicio = {
      obtenerNotificaciones: vi.fn(() => of([])),
      crearNotificacion: vi.fn(() => of({})),
      actualizarNotificacion: vi.fn(() => of({})),
      eliminarNotificacion: vi.fn(() => of({})),
    };
    await TestBed.configureTestingModule({
      imports: [Notificacion],
      providers: [{ provide: NotificacionService, useValue: servicio }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Notificacion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with the defaults and is invalid until the required fields are filled', () => {
    expect(component.formulario.getRawValue()).toEqual({
      titulo: '', mensaje: '', tipo_notificacion_codigo: 'GENERAL', alcance: 'AMBOS', fecha_desde: '', fecha_hasta: '',
    });
    expect(component.formulario.valid).toBe(false);
  });

  it('refuses to save an incomplete form', () => {
    component.guardarNotificacion();
    expect(servicio['crearNotificacion']).not.toHaveBeenCalled();
    expect(component.mensajeError).toBe('Todos los campos son obligatorios.');
  });

  it('creates the notification with the values of the form and resets it', () => {
    component.formulario.patchValue({
      titulo: 'Inscripciones', mensaje: 'Abiertas', alcance: 'ESTUDIANTE', tipo_notificacion_codigo: 'URGENTE',
      fecha_desde: '2026-10-01', fecha_hasta: '2026-10-31',
    });
    component.guardarNotificacion();

    expect(servicio['crearNotificacion']).toHaveBeenCalledWith({
      titulo: 'Inscripciones', mensaje: 'Abiertas', alcance: 'ESTUDIANTE', tipo_notificacion_codigo: 'URGENTE',
      fecha_desde: '2026-10-01', fecha_hasta: '2026-10-31', leida: false,
    });
    expect(component.formulario.getRawValue().titulo).toBe('');
  });

  it('loads a notification into the form to edit it and updates it', () => {
    component.cargarParaEditar({
      id: 'n1', titulo: 'A', mensaje: 'B', alcance: 'AMBOS', leida: false,
      fecha_desde: '2026-10-01T00:00:00', fecha_hasta: '2026-10-31T00:00:00',
    });
    expect(component.formulario.getRawValue().fecha_desde).toBe('2026-10-01T00:00');

    component.guardarNotificacion();
    expect(servicio['actualizarNotificacion']).toHaveBeenCalledWith('n1', expect.objectContaining({ titulo: 'A' }));
  });

  describe('banner timer', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('hides the banner after 4 seconds', () => {
      component.guardarNotificacion();
      expect(component.mensajeError).not.toBe('');

      vi.advanceTimersByTime(3999);
      expect(component.mensajeError).not.toBe('');
      vi.advanceTimersByTime(1);
      expect(component.mensajeError).toBe('');
    });

    it('restarts the window when a new message is shown', () => {
      component.guardarNotificacion();
      vi.advanceTimersByTime(3000);
      component.guardarNotificacion();

      vi.advanceTimersByTime(3000);
      expect(component.mensajeError).not.toBe('');
      vi.advanceTimersByTime(1000);
      expect(component.mensajeError).toBe('');
    });

    it('clears the pending timer when the view is destroyed', () => {
      component.guardarNotificacion();
      expect(vi.getTimerCount()).toBe(1);

      fixture.destroy();

      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
