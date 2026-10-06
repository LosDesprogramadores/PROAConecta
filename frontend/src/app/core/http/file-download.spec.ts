import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileDownloadService, nombreDesdeContentDisposition } from './file-download';

const URL_EXPORTAR = 'http://api.test/api/materias/exportar/';

describe('nombreDesdeContentDisposition', () => {
  it('reads a quoted file name', () => {
    expect(nombreDesdeContentDisposition('attachment; filename="materias-2026-10-06.csv"')).toBe(
      'materias-2026-10-06.csv',
    );
  });

  it('reads an unquoted file name', () => {
    expect(nombreDesdeContentDisposition('attachment; filename=boletin.pdf')).toBe('boletin.pdf');
  });

  it('prefers the UTF-8 extended form', () => {
    expect(
      nombreDesdeContentDisposition("attachment; filename=\"x.pdf\"; filename*=UTF-8''bolet%C3%ADn.pdf"),
    ).toBe('boletín.pdf');
  });

  it('returns null without a header or a name', () => {
    expect(nombreDesdeContentDisposition(null)).toBeNull();
    expect(nombreDesdeContentDisposition('attachment')).toBeNull();
  });
});

describe('FileDownloadService', () => {
  let service: FileDownloadService;
  let http: HttpTestingController;
  let click: ReturnType<typeof vi.spyOn>;
  let nombresDescargados: string[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FileDownloadService);
    http = TestBed.inject(HttpTestingController);

    nombresDescargados = [];
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      nombresDescargados.push(this.download);
    });
  });

  afterEach(() => {
    http.verify();
    click.mockRestore();
  });

  it('requests a blob with the params, skipping empty ones', () => {
    service.descargar(URL_EXPORTAR, { formato: 'pdf', rol: 3, vacio: '', nulo: null, nada: undefined }).subscribe();

    const req = http.expectOne((r) => r.url === URL_EXPORTAR);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('formato')).toBe('pdf');
    expect(req.request.params.get('rol')).toBe('3');
    expect(req.request.params.has('vacio')).toBe(false);
    expect(req.request.params.has('nulo')).toBe(false);
    expect(req.request.params.has('nada')).toBe(false);
    req.flush(new Blob(['x']));
  });

  it('saves the file with the name from Content-Disposition', () => {
    let terminado = false;
    service.descargar(URL_EXPORTAR, {}, 'respaldo.csv').subscribe(() => (terminado = true));

    http
      .expectOne((r) => r.url === URL_EXPORTAR)
      .flush(new Blob(['a,b']), { headers: { 'Content-Disposition': 'attachment; filename="materias-2026-10-06.csv"' } });

    expect(terminado).toBe(true);
    expect(nombresDescargados).toEqual(['materias-2026-10-06.csv']);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('falls back to the given name when the header is missing', () => {
    service.descargar(URL_EXPORTAR, {}, 'respaldo.csv').subscribe();
    http.expectOne((r) => r.url === URL_EXPORTAR).flush(new Blob(['a']));
    expect(nombresDescargados).toEqual(['respaldo.csv']);
  });

  it('turns a blob error body back into JSON so detail is readable', async () => {
    const error = await new Promise<HttpErrorResponse>((resolve) => {
      service.descargar(URL_EXPORTAR).subscribe({ error: resolve });
      http
        .expectOne((r) => r.url === URL_EXPORTAR)
        .flush(new Blob([JSON.stringify({ detail: 'Formato no soportado.' })]), {
          status: 400,
          statusText: 'Bad Request',
        });
    });

    expect(error.status).toBe(400);
    expect(error.error).toEqual({ detail: 'Formato no soportado.' });
    expect(nombresDescargados).toEqual([]);
  });
});
