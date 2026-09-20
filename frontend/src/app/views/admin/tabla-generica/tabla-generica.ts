import { Component, input, Input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IColumnaTabla } from '../../../model/tabla.model';

@Component({
  selector: 'app-tabla-generica',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tabla-generica.html',
  styleUrl: './tabla-generica.css',
})
export class TablaGenerica {
  @Input({ required: true }) columnas: IColumnaTabla[] = [];
  @Input({ required: true }) datos: any[] = [];
  @Input() titulo: string = '';
  @Input() mensajeVacio: string = 'No hay registros para mostrar.';
  @Input() mostrarAcciones: boolean = true;

  @Input() modalTitulo: string = '¿Estás seguro?';
  @Input() modalMensaje: string = 'Esta acción eliminará el registro seleccionado de forma permanente.';
  @Input() modalBotonTexto: string = 'Sí, eliminar';

  isLoading = input<boolean>(false);
  
  isDeleteModalOpen = signal<boolean>(false);
  filaSeleccionada = signal<any | null>(null);

  onEliminar = output<any>();

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
      this.onEliminar.emit(fila);
    }
    this.cancelarEliminacion();
  }
}