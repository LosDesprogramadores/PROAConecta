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

  mostrarFormulario = signal<boolean>(false);
  editandoId = signal<string | null>(null);

  nuevoContenido: ContenidoUnidad = {
    id: '',
    titulo: '',
    tipo: 'documento',
    url: '',
    fechaCreacion: new Date(),
  };

  mostrarFormularioNuevo() {
    this.nuevoContenido = {
      id: '',
      titulo: '',
      tipo: 'documento',
      url: '',
      fechaCreacion: new Date(),
    };
    this.editandoId.set(null);
    this.mostrarFormulario.set(true);
  }

  editarContenido(contenido: ContenidoUnidad) {
    this.nuevoContenido = { ...contenido };
    this.editandoId.set(contenido.id);
    this.mostrarFormulario.set(true);
  }

  cancelarFormulario() {
    this.mostrarFormulario.set(false);
    this.editandoId.set(null);
  }

  guardarContenido() {
    if (!this.nuevoContenido.titulo.trim()) {
      alert('El título es requerido');
      return;
    }

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

    if (!this.editandoId()) {
      // Nuevo contenido
      this.nuevoContenido.id = `contenido-${Date.now()}`;
      this.nuevoContenido.fechaCreacion = new Date();
    }

    this.contenidoGuardado.emit(this.nuevoContenido);
    this.mostrarFormulario.set(false);
  }

  eliminarContenido(id: string) {
    if (confirm('¿Eliminar este contenido?')) {
      this.contenidoEliminado.emit(id);
    }
  }

  // =============== MÉTODOS DE UTILIDAD ===============

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
    const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
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