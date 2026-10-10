import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificacionService } from '../../../services/notificaciones.service';
import { Notificacion } from './notificacion';

/** Local date as AAAA-MM-DD, the same one the form uses as default. */
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('Notificacion (admin)', () => {
  let component: Notificacion;
  let fixture: ComponentFixture<Notificacion>;
  let servicio: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    servicio = {
      listarPropias: vi.fn(() => of([])),
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

  it('starts with the defaults, "Vigente desde" is today and it is invalid until title and message are filled', () => {
    expect(component.formulario.getRawValue()).toEqual({
      titulo: '', mensaje: '', tipo_notificacion_codigo: 'GENERAL', alcance: 'AMBOS', fecha_desde: hoy(), fecha_hasta: '',
    });
    expect(component.formulario.valid).toBe(false);
  });

  it('asks only for the notices created by the administrator (propias)', () => {
    expect(servicio['listarPropias']).toHaveBeenCalledTimes(1);
  });

  it('saves without an end date (hasta is optional) and sends it as null', () => {
    component.formulario.patchValue({ titulo: 'Aviso', mensaje: 'Texto' });
    expect(component.formulario.valid).toBe(true);
    component.guardarNotificacion();
    expect(servicio['crearNotificacion']).toHaveBeenCalledWith(
      expect.objectContaining({ fecha_desde: hoy(), fecha_hasta: null }),
    );
  });

  it('requires "Vigente desde"', () => {
    component.formulario.patchValue({ titulo: 'Aviso', mensaje: 'Texto', fecha_desde: '' });
    expect(component.formulario.controls.fecha_desde.hasError('required')).toBe(true);
  });

  it('shows "Programada para dd/mm/aaaa" in the form only for a future date', () => {
    expect(component.programadaPara()).toBeNull();
    component.formulario.patchValue({ fecha_desde: '2999-03-05' });
    expect(component.programadaPara()).toBe('05/03/2999');
    component.mostrarFormulario = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Programada para 05/03/2999');
  });

  it('shows the validity badge and the scheduled date of each notice', async () => {
    servicio['listarPropias'].mockReturnValue(of([
      { id: 'a', titulo: 'Futuro', mensaje: 'm', alcance: 'AMBOS', leida: false, fecha_desde: '2999-03-05', estado_vigencia: 'PROGRAMADA' },
      { id: 'b', titulo: 'Activo', mensaje: 'm', alcance: 'PROFESOR', leida: false, fecha_desde: '2026-10-01', estado_vigencia: 'VIGENTE' },
    ]));
    component.cargarNotificaciones();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Programada para 05/03/2999');
    expect(texto).toContain('Vigente');
    expect(texto).toContain('Profesores');
  });

  it('offers the scopes Todos / Profesores / Estudiantes mapped to the backend values', () => {
    component.mostrarFormulario = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const opciones = Array.from(fixture.nativeElement.querySelectorAll('#noti-alcance option')) as HTMLOptionElement[];
    expect(opciones.map((o) => [o.value, o.textContent?.trim()])).toEqual([
      ['AMBOS', 'Todos'], ['PROFESOR', 'Profesores'], ['ESTUDIANTE', 'Estudiantes'],
    ]);
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
      fecha_desde: '2026-10-01', fecha_hasta: '2026-10-31',
    });
    expect(component.formulario.getRawValue().titulo).toBe('');
  });

  it('loads a notification into the form to edit it and updates it', () => {
    component.cargarParaEditar({
      id: 'n1', titulo: 'A', mensaje: 'B', alcance: 'AMBOS', leida: false,
      fecha_desde: '2026-10-01T00:00:00', fecha_hasta: '2026-10-31T00:00:00',
    });
    expect(component.formulario.getRawValue().fecha_desde).toBe('2026-10-01');

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
