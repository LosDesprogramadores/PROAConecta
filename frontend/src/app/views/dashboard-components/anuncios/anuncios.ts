import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Anuncio } from '../../../model/anuncio.model';
import { AnunciosService } from '../../../services/anuncios.service';
import { SidebarMaterias } from '../../../shared/sidebar-materias/sidebar-materias';

import { Modal } from '../../../shared/modal/modal';
@Component({
  selector: 'app-anuncios',
  standalone: true,
  imports: [Modal, CommonModule, SidebarMaterias],
  templateUrl: './anuncios.html',
  styleUrls: ['./anuncios.css']
})
export class Anuncios implements OnInit {
  private readonly anunciosService = inject(AnunciosService);

  anuncios = signal<Anuncio[]>([]);
  anuncioSeleccionado = signal<Anuncio | null>(null);
  cargando = signal<boolean>(true);
  error = signal<boolean>(false);

  readonly anunciosState = computed(() => ({
    data: this.anuncios(),
    cargando: this.cargando(),
    error: this.error()
  }));

  ngOnInit(): void {
    this.cargarAnuncios();
  }

  cargarAnuncios(): void {
    this.cargando.set(true);
    this.error.set(false);

    this.anunciosService.getAnuncios().subscribe({
      next: (data) => {
        const filtrados = data.filter((a) => {
          if (!a.alcance) return true;

          const alcance = a.alcance.toUpperCase();
          return (
            alcance === 'AMBOS' ||
            alcance === 'ESTUDIANTE' ||
            alcance === 'ALUMNOS' ||
            alcance === 'TODOS'
          );
        });

        this.anuncios.set(filtrados);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar la lista de anuncios:', err);
        this.error.set(true);
        this.cargando.set(false);
      }
    });
  }

  abrirModal(anuncio: Anuncio): void {
    this.anuncioSeleccionado.set(anuncio);
  }

  cerrarModal(): void {
    this.anuncioSeleccionado.set(null);
  }

  esAcademico(tipo?: string): boolean {
    const t = tipo?.toUpperCase();
    return t === 'ACADEMICO' || t === 'ACADÉMICO';
  }

  esUrgente(tipo?: string): boolean {
    return tipo?.toUpperCase() === 'URGENTE';
  }

  getTipoNotificacionBadgeClass(tipo?: string): string {
    const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border';
    
    switch (tipo?.toUpperCase()) {
      case 'ACADEMICO':
      case 'ACADÉMICO':
        return `${base} bg-purple-50 text-purple-700 border-purple-200`;
      case 'URGENTE':
        return `${base} bg-red-50 text-red-700 border-red-200 animate-pulse`;
      case 'GENERAL':
      default:
        return `${base} bg-blue-50 text-blue-700 border-blue-200`;
    }
  }
}