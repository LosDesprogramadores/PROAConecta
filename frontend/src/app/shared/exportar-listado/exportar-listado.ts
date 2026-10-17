import { Component, inject, input, signal } from '@angular/core';
import { FileDownloadService, ParametrosDescarga } from '../../core/http/file-download';
import { ToastService } from '../../services/toast.service';

export type EstadoExportacion = 'idle' | 'cargando' | 'error';
export type FormatoExportacion = 'csv' | 'pdf';

/** "Exportar CSV" and "Exportar PDF" buttons for an admin listing; they download the file the API builds. */
@Component({
  selector: 'app-exportar-listado',
  standalone: true,
  templateUrl: './exportar-listado.html',
})
export class ExportarListado {
  private readonly descargas = inject(FileDownloadService);
  private readonly toast = inject(ToastService);

  /** Absolute URL of the export endpoint (for example `${environment.apiUrl}materias/exportar/`). */
  url = input.required<string>();
  /** Active filters of the listing, sent as they are. */
  params = input<ParametrosDescarga>({});
  /** File name used only when the server does not send one. */
  recurso = input('listado');

  estado = signal<EstadoExportacion>('idle');
  formatoActivo = signal<FormatoExportacion | null>(null);

  exportar(formato: FormatoExportacion): void {
    if (this.estado() === 'cargando') {
      return;
    }
    this.estado.set('cargando');
    this.formatoActivo.set(formato);

    this.descargas
      .descargar(this.url(), { ...this.params(), formato }, `${this.recurso()}.${formato}`)
      .subscribe({
        next: () => {
          this.estado.set('idle');
          this.formatoActivo.set(null);
          this.toast.success('La descarga se generó correctamente.');
        },
        error: (err) => {
          this.estado.set('error');
          this.formatoActivo.set(null);
          this.toast.error(this.toast.readable_message_extraction(err), 'No se pudo exportar');
        },
      });
  }
}
