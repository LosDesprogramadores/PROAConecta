import { Component, Input, inject, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { UnidadMateria, ContenidoUnidad } from '../../../../model/unidad-contenido.model';

import { ConfirmDialogService } from '../../../../services/confirm-dialog.service';
import { filter } from 'rxjs';
@Component({
  selector: 'app-contenido-unidad',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contenido-unidad.html',
  styleUrl: './contenido-unidad.css',
})
export class ContenidoUnidadComponent {
  private confirmDialog = inject(ConfirmDialogService);
  private fb = inject(NonNullableFormBuilder);


  @Input() unidad!: UnidadMateria;

  @Input() esDocente = signal<boolean>(true);

  @Output() contenidoGuardado = new EventEmitter<ContenidoUnidad>();

  @Output() contenidoEliminado = new EventEmitter<string>();


  // ==========================================
  // ESTADO DEL COMPONENTE
  // ==========================================

  mostrarFormulario = signal<boolean>(false);

  editandoId = signal<string | null>(null);


  // ==========================================
  // CONTENIDO EN EDICIÓN / NUEVO
  // ==========================================

  readonly formulario = this.fb.group({
    tipo: this.fb.control<ContenidoUnidad['tipo']>('documento'),
    titulo: '',
    descripcion: '',
    url: '',
    visible: true,
  });

  /** Content being edited: its id, creation date and owner survive the edit. */
  private contenidoEnEdicion: ContenidoUnidad | null = null;


  // ==========================================
  // AGREGAR NUEVO CONTENIDO
  // ==========================================

  mostrarFormularioNuevo() {

    this.formulario.reset();

    this.contenidoEnEdicion = null;

    this.editandoId.set(null);

    this.mostrarFormulario.set(true);
  }


  // ==========================================
  // EDITAR CONTENIDO
  // ==========================================

  editarContenido(contenido: ContenidoUnidad) {

    this.formulario.setValue({
      tipo: contenido.tipo,
      titulo: contenido.titulo,
      descripcion: contenido.descripcion ?? '',
      url: contenido.url,
      visible: contenido.visible ?? true,
    });

    this.contenidoEnEdicion = { ...contenido };

    this.editandoId.set(contenido.id);

    this.mostrarFormulario.set(true);
  }


  // ==========================================
  // CANCELAR FORMULARIO
  // ==========================================

  cancelarFormulario() {

    this.mostrarFormulario.set(false);

    this.editandoId.set(null);

    this.contenidoEnEdicion = null;
  }


  // ==========================================
  // GUARDAR / ACTUALIZAR CONTENIDO
  // ==========================================

  guardarContenido() {

    const valores = this.formulario.getRawValue();

    // Validar título
    if (!valores.titulo.trim()) {

      alert('El título es requerido');

      return;
    }


    // Validar URL
    if (!valores.url.trim()) {

      alert('La URL es requerida');

      return;
    }


    // Validar URL
    try {

      new URL(valores.url);

    } catch {

      alert('Por favor ingresa una URL válida (ej: https://...)');

      return;
    }


    const contenido: ContenidoUnidad = this.editandoId() && this.contenidoEnEdicion
      ? { ...this.contenidoEnEdicion, ...valores }
      : {
          ...valores,
          // Nuevo contenido: id y fecha propios, siempre visible
          id: `contenido-${Date.now()}`,
          fechaCreacion: new Date(),
          visible: true,
        };


    // Emitir contenido a Portada
    this.contenidoGuardado.emit(contenido);


    // Cerrar formulario
    this.mostrarFormulario.set(false);

    this.editandoId.set(null);

    this.contenidoEnEdicion = null;
  }


  // ==========================================
  // MOSTRAR / OCULTAR
  // ==========================================

  cambiarVisibilidad(contenido: ContenidoUnidad) {

    contenido.visible = !contenido.visible;

    // Avisar a Portada del cambio
    this.contenidoGuardado.emit({
      ...contenido
    });
  }


  // ==========================================
  // ELIMINAR
  // ==========================================

  eliminarContenido(id: string) {

    this.confirmDialog.confirmar('¿Eliminar este contenido?').pipe(filter(Boolean)).subscribe(() => {

      this.contenidoEliminado.emit(id);
    });
  }


  // ==========================================
  // UTILIDADES
  // ==========================================

  tipoLabel(tipo: string): string {

    const labels: Record<string, string> = {

      documento: '📄 Documento',

      video: '🎥 Video',

      enlace: '🔗 Enlace',

    };

    return labels[tipo] || tipo;
  }


  tipoLabelCorto(tipo: string): string {

    const labels: Record<string, string> = {

      documento: 'Documento',

      video: 'Video',

      enlace: 'Enlace',

    };

    return labels[tipo] || tipo;
  }


  iconoTipo(tipo: string): string {

    const iconos: Record<string, string> = {

      documento: '📄',

      video: '🎥',

      enlace: '🔗',

    };

    return iconos[tipo] || '📎';
  }


  fechaFormato(fecha: Date | string): string {

    const d = typeof fecha === 'string'
      ? new Date(fecha)
      : fecha;

    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }


  getTipoAyuda(): string {

    const ayudas: Record<string, string> = {

      documento: '📄 Para documentos en Google Drive:',

      video: '🎥 Para videos en YouTube/Vimeo:',

      enlace: '🔗 Para enlaces generales:',

    };

    return ayudas[this.formulario.controls.tipo.value] || '';
  }


  getAyudaLinks(): string[] {

    const ayudas: Record<string, string[]> = {

      documento: [
        'Abre el archivo en Google Drive',
        'Click en "Compartir" → Copiar el link compartible',
        'Pega el link aquí (debe ser accesible)'
      ],

      video: [
        'Copia la URL de YouTube o Vimeo',
        'Puede ser la URL corta o larga',
        'Se visualizará directamente en la plataforma'
      ],

      enlace: [
        'Pega cualquier URL válida (http:// o https://)',
        'Se abrirá en una nueva ventana',
        'Ideal para recursos externos'
      ]

    };

    return ayudas[this.formulario.controls.tipo.value] || [];
  }
}