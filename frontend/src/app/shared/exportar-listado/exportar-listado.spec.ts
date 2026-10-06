import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileDownloadService } from '../../core/http/file-download';
import { ToastService } from '../../services/toast.service';
import { ExportarListado } from './exportar-listado';

describe('ExportarListado', () => {
  let fixture: ComponentFixture<ExportarListado>;
  let descargar: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; readable_message_extraction: ReturnType<typeof vi.fn> };

  const botones = () => Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'));

  beforeEach(async () => {
    descargar = vi.fn(() => of(undefined));
    toast = {
      success: vi.fn(),
      error: vi.fn(),
      readable_message_extraction: vi.fn(() => 'Mensaje legible'),
    };
    await TestBed.configureTestingModule({
      imports: [ExportarListado],
      providers: [
        { provide: FileDownloadService, useValue: { descargar } },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportarListado);
    fixture.componentRef.setInput('url', 'http://api.test/api/personas/exportar/');
    fixture.componentRef.setInput('params', { rol: 3 });
    fixture.componentRef.setInput('recurso', 'estudiantes');
    await fixture.whenStable();
  });

  it('shows the CSV and PDF buttons', () => {
    expect(botones().map((b) => b.textContent?.trim())).toEqual(['Exportar CSV', 'Exportar PDF']);
  });

  it('downloads the chosen format keeping the active filters', () => {
    botones()[1].click();

    expect(descargar).toHaveBeenCalledWith(
      'http://api.test/api/personas/exportar/',
      { rol: 3, formato: 'pdf' },
      'estudiantes.pdf',
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('disables both buttons and sets aria-busy while downloading', async () => {
    const pendiente = new Subject<void>();
    descargar.mockReturnValue(pendiente);

    botones()[0].click();
    fixture.detectChanges();

    expect(botones().every((b) => b.disabled)).toBe(true);
    expect(botones()[0].getAttribute('aria-busy')).toBe('true');
    expect(botones()[1].getAttribute('aria-busy')).toBe('false');

    pendiente.next();
    pendiente.complete();
    fixture.detectChanges();
    expect(botones().some((b) => b.disabled)).toBe(false);
  });

  it('shows a readable error toast and re-enables the buttons when the download fails', () => {
    const fallo = new Error('boom');
    descargar.mockReturnValue(throwError(() => fallo));

    botones()[0].click();
    fixture.detectChanges();

    expect(toast.readable_message_extraction).toHaveBeenCalledWith(fallo);
    expect(toast.error).toHaveBeenCalledWith('Mensaje legible', 'No se pudo exportar');
    expect(fixture.componentInstance.estado()).toBe('error');
    expect(botones().some((b) => b.disabled)).toBe(false);
  });
});
