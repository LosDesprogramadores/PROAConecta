import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { ToastService } from '../../services/toast.service';
import { ArchivoProtegidoDirective } from './archivo-protegido.directive';
import { FileDownloadService, esRutaDeArchivo, urlDeArchivo } from './file-download';

@Component({
  standalone: true,
  imports: [ArchivoProtegidoDirective],
  template: `<a id="enlace" [href]="url()" [appArchivoProtegido]="url()" target="_blank">Abrir</a>`,
})
class Anfitrion {
  url = signal<string | null>('/api/archivos/material/7/');
}

describe('helpers de archivos protegidos', () => {
  it('recognizes the download route of the API', () => {
    expect(esRutaDeArchivo('/api/archivos/entrega/3/')).toBe(true);
    expect(esRutaDeArchivo(`${environment.apiUrl}archivos/material/1/`)).toBe(true);
    expect(esRutaDeArchivo('https://example.com/api/archivos/x/')).toBe(false);
    expect(esRutaDeArchivo('https://drive.google.com/file')).toBe(false);
    expect(esRutaDeArchivo('#')).toBe(false);
    expect(esRutaDeArchivo(null)).toBe(false);
  });

  it('resolves the route against the API url so the interceptor sends the token', () => {
    const url = urlDeArchivo('/api/archivos/actividad/2/');
    expect(url).toBe(`${environment.apiUrl}archivos/actividad/2/`);
    expect(url.startsWith(environment.apiUrl)).toBe(true);
  });

  it('leaves other urls untouched', () => {
    expect(urlDeArchivo('https://example.com/a')).toBe('https://example.com/a');
  });
});

describe('ArchivoProtegidoDirective', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let descargar: ReturnType<typeof vi.fn>;
  let toast: { error: ReturnType<typeof vi.fn>; readable_message_extraction: ReturnType<typeof vi.fn> };

  function clic(): MouseEvent {
    const evento = new MouseEvent('click', { bubbles: true, cancelable: true });
    fixture.debugElement.query(By.css('#enlace')).nativeElement.dispatchEvent(evento);
    return evento;
  }

  beforeEach(() => {
    descargar = vi.fn(() => of(undefined));
    toast = { error: vi.fn(), readable_message_extraction: vi.fn(() => 'No tenés acceso a este archivo.') };
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [
        { provide: FileDownloadService, useValue: { descargar } },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  it('downloads an uploaded file with the authenticated client instead of following the link', () => {
    const evento = clic();

    expect(evento.defaultPrevented).toBe(true);
    expect(descargar).toHaveBeenCalledWith(`${environment.apiUrl}archivos/material/7/`, {}, 'archivo');
  });

  it('keeps the normal behaviour for external links', () => {
    fixture.componentInstance.url.set('https://example.com/video');
    fixture.detectChanges();

    const evento = clic();

    expect(evento.defaultPrevented).toBe(false);
    expect(descargar).not.toHaveBeenCalled();
  });

  it('shows a readable error when the download is denied', () => {
    descargar.mockReturnValue(throwError(() => ({ status: 404 })));

    clic();

    expect(toast.error).toHaveBeenCalledWith('No tenés acceso a este archivo.', 'No se pudo descargar el archivo');
  });
});
