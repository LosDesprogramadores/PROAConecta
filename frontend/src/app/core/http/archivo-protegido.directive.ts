import { Directive, inject, input } from '@angular/core';

import { ToastService } from '../../services/toast.service';
import { FileDownloadService, esRutaDeArchivo, urlDeArchivo } from './file-download';

/**
 * Uploaded files are not public: the API serves them at `/api/archivos/<tipo>/<id>/` and needs the JWT,
 * which a plain `<a href>` does not send. On click this directive downloads the file through the
 * authenticated HTTP client. Any other value (an external link, `#`, nothing) keeps the normal link behaviour.
 *
 * Usage: `<a [href]="url" [appArchivoProtegido]="url" target="_blank">`.
 */
@Directive({
  selector: 'a[appArchivoProtegido]',
  standalone: true,
  host: { '(click)': 'alHacerClic($event)' },
})
export class ArchivoProtegidoDirective {
  private readonly descargas = inject(FileDownloadService);
  private readonly toast = inject(ToastService);

  readonly appArchivoProtegido = input<string | File | null | undefined>();

  alHacerClic(evento: Event): void {
    const valor = this.appArchivoProtegido();
    if (typeof valor !== 'string' || !esRutaDeArchivo(valor)) {
      return;
    }
    evento.preventDefault();
    this.descargas.descargar(urlDeArchivo(valor), {}, 'archivo').subscribe({
      error: (err) => this.toast.error(this.toast.readable_message_extraction(err), 'No se pudo descargar el archivo'),
    });
  }
}
