import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { filter } from 'rxjs';

import { ContenidoUnidad, UnidadMateria } from '../../../model/unidad-contenido.model';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { ContenidoFormComponent } from './contenido-form/contenido-form';
import { ContenidoItemComponent } from './contenido-item/contenido-item';

/**
 * Container of a unit's content block. It owns the state (is the form open, which content is being
 * edited) and talks to the parent; the list item and the form are presentational components.
 */
@Component({
  selector: 'app-contenido-unidad',
  standalone: true,
  imports: [ContenidoItemComponent, ContenidoFormComponent],
  templateUrl: './contenido-unidad.html',
  styleUrl: './contenido-unidad.css',
})
export class ContenidoUnidadComponent {
  private confirmDialog = inject(ConfirmDialogService);

  @Input() unidad!: UnidadMateria;

  @Input() esDocente = signal<boolean>(true);

  @Output() contenidoGuardado = new EventEmitter<ContenidoUnidad>();

  @Output() contenidoEliminado = new EventEmitter<string>();

  mostrarFormulario = signal<boolean>(false);

  /** Content being edited; null while adding a new one. */
  contenidoEnEdicion = signal<ContenidoUnidad | null>(null);

  mostrarFormularioNuevo(): void {
    this.contenidoEnEdicion.set(null);
    this.mostrarFormulario.set(true);
  }

  editarContenido(contenido: ContenidoUnidad): void {
    this.contenidoEnEdicion.set({ ...contenido });
    this.mostrarFormulario.set(true);
  }

  cancelarFormulario(): void {
    this.mostrarFormulario.set(false);
    this.contenidoEnEdicion.set(null);
  }

  guardarContenido(contenido: ContenidoUnidad): void {
    this.contenidoGuardado.emit(contenido);
    this.cancelarFormulario();
  }

  cambiarVisibilidad(contenido: ContenidoUnidad): void {
    contenido.visible = !contenido.visible;
    // Tell the portada about the change
    this.contenidoGuardado.emit({ ...contenido });
  }

  eliminarContenido(id: string): void {
    this.confirmDialog
      .confirmar('¿Eliminar este contenido?')
      .pipe(filter(Boolean))
      .subscribe(() => this.contenidoEliminado.emit(id));
  }
}
