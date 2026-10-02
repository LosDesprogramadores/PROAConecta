import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, catchError, of } from 'rxjs';
import { Anuncio } from '../../../../model/anuncio.model';
import { AnunciosService } from '../../../../services/anuncios.service';

@Component({
  selector: 'app-anuncios-resumen',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './anuncios-resumen.html',
  styleUrl: './anuncios-resumen.css',
})
export class AnunciosResumen {
  private readonly anunciosService = inject(AnunciosService);

  // Modal State
  readonly anuncioSeleccionado = signal<Anuncio | null>(null);

  // Estado reactivo derivado del Observable del servicio
  readonly ultimaNovedadState = toSignal(
    this.anunciosService.getAnuncios().pipe(
      map((anuncios) => {
        const anunciosEstudiante = anuncios.filter((n) => {
          if (!n.alcance) return true;
          const alc = n.alcance.toUpperCase();
          return ['AMBOS', 'ESTUDIANTE', 'ALUMNOS', 'TODOS'].includes(alc);
        });

        return {
          data: anunciosEstudiante[0] ?? null,
          cargando: false,
          error: false,
        };
      }),
      catchError((err) => {
        console.error('Error al obtener los anuncios:', err);
        return of({
          data: null,
          cargando: false,
          error: true,
        });
      })
    ),
    {
      initialValue: { data: null, cargando: true, error: false },
    }
  );

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