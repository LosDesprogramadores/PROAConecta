import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { Actividad } from '../../../../model/actividad-model';
import { ActividadesService, Entrega } from '../../../../services/actividades.service';
import { ToastService } from '../../../../services/toast.service';
import { ActividadEstudiante } from './actividad-estudiante';

const actividad = { id: 4, materia: 7, titulo: 'TP 1', fecha_limite: '2999-01-01T00:00:00Z', permitir_entrega_tardia: false } as unknown as Actividad;
const miEntrega: Entrega = {
  id: 9, actividad: 4, estudiante: 30, estudiante_nombre: 'Ana', fecha_entrega: '2026-10-01T10:00:00Z',
  contenido_texto: 'Mi respuesta', enlace: 'https://repo.test', nota: null,
};

describe('ActividadEstudiante delivery form', () => {
  let fixture: ComponentFixture<ActividadEstudiante>;
  let component: ActividadEstudiante;
  let servicio: Record<string, ReturnType<typeof vi.fn>>;
  const toast = { toasts: signal([]), warning: vi.fn(), success: vi.fn(), error: vi.fn(), readable_message_extraction: vi.fn(() => 'Error') };

  beforeEach(async () => {
    toast.warning.mockClear();
    toast.success.mockClear();
    servicio = {
      getActividades: vi.fn(() => of([actividad])),
      getMisEntregas: vi.fn(() => of([miEntrega])),
      crearEntrega: vi.fn(() => of(miEntrega)),
      actualizarEntrega: vi.fn(() => of(miEntrega)),
    };
    await TestBed.configureTestingModule({
      imports: [ActividadEstudiante],
      providers: [
        provideRouter([]),
        { provide: ActividadesService, useValue: servicio },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        { provide: ToastService, useValue: toast },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: '7' }, queryParams: {} }, parent: null } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActividadEstudiante);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens an empty reactive form for a new delivery', () => {
    component.abrirModalEntrega({ ...actividad, id: 99 } as Actividad);
    expect(component.modoEdicion()).toBe(true);
    expect(component.formEntrega.getRawValue()).toEqual({ contenidoTexto: '', enlaceUrl: '' });
  });

  it('fills the form from the existing delivery and edits only after "habilitarEdicion"', () => {
    component.abrirModalEntrega(actividad);
    expect(component.formEntrega.getRawValue()).toEqual({ contenidoTexto: 'Mi respuesta', enlaceUrl: 'https://repo.test' });
    expect(component.modoEdicion()).toBe(false);

    component.habilitarEdicion();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#entrega-texto')).not.toBeNull();
    expect((fixture.nativeElement.querySelector('#entrega-texto') as HTMLTextAreaElement).value).toBe('Mi respuesta');
  });

  it('refuses an empty delivery with a warning', () => {
    component.abrirModalEntrega({ ...actividad, id: 99 } as Actividad);
    component.guardarEntrega();
    expect(servicio['crearEntrega']).not.toHaveBeenCalled();
    expect(component.errorFormulario()).toContain('al menos un archivo');
    expect(toast.warning).toHaveBeenCalled();
  });

  it('sends the trimmed text and link as multipart data', () => {
    component.abrirModalEntrega({ ...actividad, id: 99 } as Actividad);
    component.formEntrega.setValue({ contenidoTexto: '  hola ', enlaceUrl: ' https://x.test ' });
    component.guardarEntrega();

    const datos = servicio['crearEntrega'].mock.calls[0][0] as FormData;
    expect(datos.get('contenido_texto')).toBe('hola');
    expect(datos.get('enlace')).toBe('https://x.test');
    expect(datos.get('actividad')).toBe('99');
  });

  it('updates the existing delivery instead of creating another one', () => {
    component.abrirModalEntrega(actividad);
    component.habilitarEdicion();
    component.formEntrega.patchValue({ contenidoTexto: 'Nueva versión' });
    component.guardarEntrega();
    expect(servicio['actualizarEntrega']).toHaveBeenCalledWith(9, expect.any(FormData));
    expect(servicio['crearEntrega']).not.toHaveBeenCalled();
  });

  it('clears the form when the modal closes', () => {
    component.abrirModalEntrega(actividad);
    component.cerrarModalEntrega();
    expect(component.formEntrega.getRawValue()).toEqual({ contenidoTexto: '', enlaceUrl: '' });
  });
});
