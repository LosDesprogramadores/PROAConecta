import { Component, input, Input, output, signal } from '@angular/core';
import { Modal } from '../../../shared/modal/modal';
import { IColumnaTabla } from '../../../model/tabla.model';
import { ParametrosDescarga } from '../../../core/http/file-download';
import { Paginador } from '../../../shared/paginador/paginador';
import { ExportarListado } from '../../../shared/exportar-listado/exportar-listado';

@Component({
  selector: 'app-tabla-generica',
  standalone: true,
  imports: [Modal, ExportarListado, Paginador],
  templateUrl: './tabla-generica.html',
  styleUrl: './tabla-generica.css',
})
export class TablaGenerica {
  @Input({ required: true }) columnas: IColumnaTabla[] = [];
  @Input({ required: true }) datos: any[] = [];
  @Input() titulo = '';
  @Input() mensajeVacio = 'No hay registros para mostrar.';
  @Input() mostrarAcciones = true;

  /** Export endpoint. When empty (default) the export buttons are not shown. */
  @Input() exportarUrl = '';
  @Input() exportarParams: ParametrosDescarga = {};
  @Input() exportarRecurso = 'listado';

  /**
   * Server-side pagination. When `totalRegistros` is null (default) the table renders every row in
   * `datos` and shows no pager, as before.
   */
  @Input() totalRegistros: number | null = null;
  @Input() paginaActual = 1;
  @Input() tamanoPagina = 50;
  paginaCambiada = output<number>();

  @Input() modalTitulo = '¿Estás seguro?';
  @Input() modalMensaje = 'Esta acción eliminará el registro seleccionado de forma permanente.';
  @Input() modalBotonTexto = 'Sí, eliminar';

  isLoading = input<boolean>(false);
  
  isDeleteModalOpen = signal<boolean>(false);
  filaSeleccionada = signal<any | null>(null);

  eliminar = output<any>();

  obtenerValor(fila: any, campo: string): any {
    if (!campo) return '';
    return campo.split('.').reduce((acc, clave) => acc && acc[clave], fila) ?? '-';
  }

  abrirModalEliminar(fila: any) {
    this.filaSeleccionada.set(fila);
    this.isDeleteModalOpen.set(true);
  }

  cancelarEliminacion() {
    this.filaSeleccionada.set(null);
    this.isDeleteModalOpen.set(false);
  }

  confirmarEliminacion() {
    const fila = this.filaSeleccionada();
    if (fila) {
      this.eliminar.emit(fila);
    }
    this.cancelarEliminacion();
  }
}