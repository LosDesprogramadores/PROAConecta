import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastService } from './toast.service';

const DJANGO_DEBUG_PAGE =
  '<!DOCTYPE html><html><head><title>ValueError at /api/x/</title></head>' +
  '<body><h1>Traceback (most recent call last):</h1></body></html>';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  describe('error()', () => {
    it('uses the default title when the caller sends none', () => {
      service.error('Algo falló', '');
      expect(service.toasts()[0].titulo).toBe('Error al cargar los datos');
    });

    it('respects the title sent by the caller', () => {
      service.error('Algo falló', 'No se pudo guardar');
      expect(service.toasts()[0].titulo).toBe('No se pudo guardar');
    });
  });

  describe('stacking limits', () => {
    it('does not stack identical persistent error toasts', () => {
      service.error('Algo falló', 'Título');
      service.error('Algo falló', 'Título');
      expect(service.toasts().length).toBe(1);
    });

    it('keeps distinct errors as separate toasts', () => {
      service.error('Falló A', 'Título');
      service.error('Falló B', 'Título');
      expect(service.toasts().length).toBe(2);
    });

    it('caps visible toasts at 5 and drops the oldest', () => {
      for (let i = 1; i <= 7; i++) {
        service.error(`Falló ${i}`);
      }
      const mensajes = service.toasts().map(t => t.mensaje);
      expect(mensajes).toEqual(['Falló 3', 'Falló 4', 'Falló 5', 'Falló 6', 'Falló 7']);
    });

    it('marks error toasts as persistent and the rest as transient', () => {
      service.error('Falló');
      service.success('ok');
      expect(service.toasts().map(t => t.persistente)).toEqual([true, false]);
    });
  });

  describe('auto-dismiss', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('keeps error toasts until the user closes them', () => {
      service.error('Algo falló');
      vi.advanceTimersByTime(60_000);
      expect(service.toasts().length).toBe(1);
      service.remove(service.toasts()[0].id);
      expect(service.toasts().length).toBe(0);
    });

    it('still auto-dismisses success, info and warning toasts', () => {
      service.success('ok');
      service.info('info');
      service.warning('ojo');
      expect(service.toasts().length).toBe(3);
      vi.advanceTimersByTime(4000);
      expect(service.toasts().length).toBe(0);
    });
  });

  describe('readable_message_extraction()', () => {
    it('never exposes an HTML body or a traceback on a 500', () => {
      const err = new HttpErrorResponse({ status: 500, error: DJANGO_DEBUG_PAGE });
      const msg = service.readable_message_extraction(err);
      expect(msg).not.toContain('Traceback');
      expect(msg).not.toContain('<');
      expect(msg).toBe('Ocurrió un error en el servidor. Intenta nuevamente más tarde.');
    });

    it('ignores the body of a 5xx even when it is a short detail string', () => {
      const err = new HttpErrorResponse({ status: 502, error: { detail: 'upstream boom' } });
      expect(service.readable_message_extraction(err)).toBe(
        'Ocurrió un error en el servidor. Intenta nuevamente más tarde.',
      );
    });

    it('maps status 0 to a connectivity message', () => {
      const err = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });
      expect(service.readable_message_extraction(err)).toBe(
        'No se pudo conectar con el servidor. Revisa tu conexión.',
      );
    });

    it('maps 401, 403 and 404 to friendly messages', () => {
      expect(service.readable_message_extraction(new HttpErrorResponse({ status: 401 }))).toContain('sesión');
      expect(service.readable_message_extraction(new HttpErrorResponse({ status: 403 }))).toContain('permisos');
      expect(service.readable_message_extraction(new HttpErrorResponse({ status: 404 }))).toContain('No se encontró');
    });

    it('uses a short string detail on a 4xx', () => {
      const err = new HttpErrorResponse({ status: 400, error: { detail: 'La materia ya está asignada.' } });
      expect(service.readable_message_extraction(err)).toBe('La materia ya está asignada.');
    });

    it('rejects a long or HTML detail and falls back to the status message', () => {
      const long = new HttpErrorResponse({ status: 400, error: { detail: 'x'.repeat(500) } });
      const html = new HttpErrorResponse({ status: 400, error: { detail: '<b>boom</b>' } });
      expect(service.readable_message_extraction(long)).toBe('Los datos enviados no son válidos.');
      expect(service.readable_message_extraction(html)).toBe('Los datos enviados no son válidos.');
    });

    it('shows only the message of a DRF field error, never the field name', () => {
      const err = new HttpErrorResponse({ status: 400, error: { email: ['Ingrese un email válido.'] } });
      expect(service.readable_message_extraction(err)).toBe('Ingrese un email válido.');
    });

    it('does not leak the raw message of a generic Error', () => {
      const msg = service.readable_message_extraction(new Error('Http failure response for http://x: 500'));
      expect(msg).toBe('Ocurrió un error inesperado. Intenta nuevamente.');
    });

    it('logs technical detail to the console in dev mode', () => {
      service.readable_message_extraction(new HttpErrorResponse({ status: 500, error: DJANGO_DEBUG_PAGE }));
      expect(console.error).toHaveBeenCalled();
    });
  });
});
