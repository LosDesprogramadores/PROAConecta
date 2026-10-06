import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
