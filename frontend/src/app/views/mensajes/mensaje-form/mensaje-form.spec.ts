import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../../environments/environment';
import { IMateria } from '../../../model/materia.model';
import { Mensaje } from '../../../model/mensaje.model';
import { ToastService } from '../../../services/toast.service';
import { MensajeForm } from './mensaje-form';

const base = `${environment.apiUrl}mensajes/`;
const materias: IMateria[] = [
  { id: 7, titulo: 'Matemática I', anio: 1, curso: 'A' },
  { id: 8, titulo: 'Física', anio: 1, curso: 'A' },
];

describe('MensajeForm', () => {
  let fixture: ComponentFixture<MensajeForm>;
  let http: HttpTestingController;
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    readable_message_extraction: vi.fn(() => 'Texto del servidor'),
  };

  function crear(materiaInicial: number | null = null): MensajeForm {
    fixture = TestBed.createComponent(MensajeForm);
    fixture.componentRef.setInput('materias', materias);
    fixture.componentRef.setInput('materiaInicial', materiaInicial);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const destinatarios = (id: number, lista: unknown[]) =>
    http.expectOne(`${environment.apiUrl}materias/${id}/destinatarios/`).flush(lista);

  beforeEach(async () => {
    Object.values(toast).forEach((f) => (f as ReturnType<typeof vi.fn>).mockClear());
    await TestBed.configureTestingModule({
      imports: [MensajeForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('keeps the recipient disabled until a subject is chosen, then loads only the allowed ones', () => {
    const c = crear();
    expect(c.formulario.controls.destinatario.disabled).toBe(true);

    c.formulario.controls.materia.setValue(7);
    destinatarios(7, [
      { id: 31, nombre_completo: 'Gómez, Lucía', rol: 'ESTUDIANTE' },
      { id: 32, nombre_completo: 'Ruiz, Tomás', rol: 'ESTUDIANTE' },
    ]);
    expect(c.destinatarios().length).toBe(2);
    expect(c.formulario.controls.destinatario.enabled).toBe(true);
    expect(c.formulario.controls.destinatario.value).toBeNull();
  });

  it('selects the only recipient automatically (the student writes to the titular professor)', () => {
    const c = crear();
    c.formulario.controls.materia.setValue(7);
    destinatarios(7, [{ id: 12, nombre_completo: 'Pérez, Ana', rol: 'PROFESOR' }]);
    expect(c.formulario.controls.destinatario.value).toBe(12);
  });

  it('resets the recipient when the subject changes', () => {
    const c = crear();
    c.formulario.controls.materia.setValue(7);
    destinatarios(7, [{ id: 12, nombre_completo: 'Pérez, Ana', rol: 'PROFESOR' }]);

    c.formulario.controls.materia.setValue(8);
    expect(c.formulario.controls.destinatario.value).toBeNull();
    destinatarios(8, []);
    expect(c.destinatarios()).toEqual([]);
  });

  it('preselects the subject of the filter', () => {
    crear(8);
    destinatarios(8, []);
  });

  it('validates required fields and the max lengths (asunto 120, cuerpo 2000)', () => {
    const c = crear();
    expect(c.formulario.valid).toBe(false);
    c.formulario.controls.asunto.setValue('a'.repeat(121));
    c.formulario.controls.cuerpo.setValue('b'.repeat(2001));
    expect(c.formulario.controls.asunto.errors?.['maxlength']).toBeTruthy();
    expect(c.formulario.controls.cuerpo.errors?.['maxlength']).toBeTruthy();
  });

  it('does not send an invalid form', () => {
    const c = crear();
    c.enviar();
    http.expectNone(base);
  });

  function completar(c: MensajeForm): void {
    c.formulario.controls.materia.setValue(7);
    destinatarios(7, [{ id: 12, nombre_completo: 'Pérez, Ana', rol: 'PROFESOR' }]);
    c.formulario.patchValue({ asunto: 'Consulta', cuerpo: 'Hola' });
  }

  it('sends the contract body and emits the created message', () => {
    const c = crear();
    const enviados: Mensaje[] = [];
    c.enviado.subscribe((m) => enviados.push(m));
    completar(c);

    c.enviar();
    const req = http.expectOne(base);
    expect(req.request.body).toEqual({ materia_id: 7, destinatario_id: 12, asunto: 'Consulta', cuerpo: 'Hola' });
    req.flush({ id: 'm1' });

    expect(enviados.length).toBe(1);
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows the 429 rate-limit message as a warning toast', () => {
    const c = crear();
    completar(c);
    c.enviar();
    http
      .expectOne(base)
      .flush({ detail: 'Enviaste demasiados mensajes. Intentá de nuevo en un momento.' }, { status: 429, statusText: 'Too Many' });

    expect(toast.warning).toHaveBeenCalledWith('Texto del servidor', expect.any(String));
    expect(toast.error).not.toHaveBeenCalled();
    expect(c.enviando()).toBe(false);
  });

  it('shows other errors through the error toast and keeps the text', () => {
    const c = crear();
    completar(c);
    c.enviar();
    http.expectOne(base).flush({ detail: 'No' }, { status: 403, statusText: 'Forbidden' });
    expect(toast.error).toHaveBeenCalled();
    expect(c.formulario.controls.asunto.value).toBe('Consulta');
  });

  const enviar = (c: MensajeForm) => (c as unknown as { enviar(): void }).enviar();

  it('does not send while the recipients are loading', () => {
    const c = crear(null);
    c.formulario.controls.materia.setValue(7);
    c.formulario.patchValue({ asunto: 'A', cuerpo: 'B' });
    expect(c.puedeEnviar()).toBe(false);
    enviar(c);
    http.expectOne(`${environment.apiUrl}materias/7/destinatarios/`);
    http.expectNone(base);
  });

  it('does not send when the subject has no recipients and says so', () => {
    const c = crear(null);
    c.formulario.controls.materia.setValue(7);
    destinatarios(7, []);
    c.formulario.patchValue({ asunto: 'A', cuerpo: 'B' });
    fixture.detectChanges();

    expect(c.puedeEnviar()).toBe(false);
    enviar(c);
    http.expectNone(base);
    expect(document.body.textContent).toContain('No hay destinatarios disponibles en esta materia');
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('does not send with several recipients until one is chosen', () => {
    const c = crear(null);
    c.formulario.controls.materia.setValue(7);
    destinatarios(7, [
      { id: 31, nombre_completo: 'A', rol: 'ESTUDIANTE' },
      { id: 32, nombre_completo: 'B', rol: 'ESTUDIANTE' },
    ]);
    c.formulario.patchValue({ asunto: 'A', cuerpo: 'B' });
    enviar(c);
    http.expectNone(base);
  });

  describe('reply mode (destinatarioInicial)', () => {
    function crearRespuesta(destinatario: number): MensajeForm {
      fixture = TestBed.createComponent(MensajeForm);
      fixture.componentRef.setInput('materias', materias);
      fixture.componentRef.setInput('materiaInicial', 7);
      fixture.componentRef.setInput('destinatarioInicial', destinatario);
      fixture.componentRef.setInput('asuntoInicial', 'Re: Consulta TP 2');
      fixture.detectChanges();
      return fixture.componentInstance;
    }

    it('fixes the subject, the recipient and the "Re: ..." subject, and sends through the existing endpoint', () => {
      const c = crearRespuesta(31);
      destinatarios(7, [
        { id: 31, nombre_completo: 'Gómez, Lucía', rol: 'ESTUDIANTE' },
        { id: 32, nombre_completo: 'Ruiz, Tomás', rol: 'ESTUDIANTE' },
      ]);

      expect(c.destinatarios().map((d) => d.id)).toEqual([31]);
      expect(c.formulario.controls.materia.disabled).toBe(true);
      expect(c.formulario.controls.destinatario.disabled).toBe(true);
      expect(c.formulario.controls.asunto.value).toBe('Re: Consulta TP 2');

      c.formulario.patchValue({ cuerpo: 'Sí, entra' });
      c.enviar();
      const req = http.expectOne(base);
      expect(req.request.body).toEqual({ materia_id: 7, destinatario_id: 31, asunto: 'Re: Consulta TP 2', cuerpo: 'Sí, entra' });
      req.flush({ id: 'm2' });
    });

    it('does not allow replying when the counterpart is no longer an allowed recipient', () => {
      const c = crearRespuesta(99);
      destinatarios(7, [{ id: 31, nombre_completo: 'Gómez, Lucía', rol: 'ESTUDIANTE' }]);

      expect(c.destinatarios()).toEqual([]);
      expect(c.puedeEnviar()).toBe(false);
      c.formulario.patchValue({ cuerpo: 'Hola' });
      c.enviar();
      http.expectNone(base);
    });
  });
});
