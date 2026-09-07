import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UnidadMateria, ContenidoUnidad } from '../../../../model/unidad-contenido.model';

@Component({
  selector: 'app-contenido-unidad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contenido-unidad.html',
  styleUrl: './contenido-unidad.css',
})
export class ContenidoUnidadComponent {

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

  nuevoContenido: ContenidoUnidad = {
    id: '',
    titulo: '',
    descripcion: '',
    tipo: 'documento',
    url: '',
    fechaCreacion: new Date(),
    visible: true,
  };


  // ==========================================
  // AGREGAR NUEVO CONTENIDO
  // ==========================================

  mostrarFormularioNuevo() {

    this.nuevoContenido = {
      id: '',
      titulo: '',
      descripcion: '',
      tipo: 'documento',
      url: '',
      fechaCreacion: new Date(),
      visible: true,
    };

    this.editandoId.set(null);

    this.mostrarFormulario.set(true);
  }


  // ==========================================
  // EDITAR CONTENIDO
  // ==========================================

  editarContenido(contenido: ContenidoUnidad) {

    this.nuevoContenido = {
      ...contenido
    };

    this.editandoId.set(contenido.id);

    this.mostrarFormulario.set(true);
  }


  // ==========================================
  // CANCELAR FORMULARIO
  // ==========================================

  cancelarFormulario() {

    this.mostrarFormulario.set(false);

    this.editandoId.set(null);
  }


  // ==========================================
  // GUARDAR / ACTUALIZAR CONTENIDO
  // ==========================================

  guardarContenido() {

    // Validar título
    if (!this.nuevoContenido.titulo.trim()) {

      alert('El título es requerido');

      return;
    }


    // Validar URL
    if (!this.nuevoContenido.url.trim()) {

      alert('La URL es requerida');

      return;
    }


    // Validar URL
    try {

      new URL(this.nuevoContenido.url);

    } catch {

      alert('Por favor ingresa una URL válida (ej: https://...)');

      return;
    }


    // ==========================================
    // NUEVO CONTENIDO
    // ==========================================

    if (!this.editandoId()) {

      this.nuevoContenido.id = `contenido-${Date.now()}`;

      this.nuevoContenido.fechaCreacion = new Date();

      this.nuevoContenido.visible = true;
    }


    // Emitir contenido a Portada
    this.contenidoGuardado.emit({
      ...this.nuevoContenido
    });


    // Cerrar formulario
    this.mostrarFormulario.set(false);

    this.editandoId.set(null);
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

    if (confirm('¿Eliminar este contenido?')) {

      this.contenidoEliminado.emit(id);
    }
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

    return ayudas[this.nuevoContenido.tipo] || '';
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

    return ayudas[this.nuevoContenido.tipo] || [];
  }
}