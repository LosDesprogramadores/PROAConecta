import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Anuncio } from '../../../../model/anuncio.model';
import { AnunciosService } from '../../../../services/anuncios.service';

@Component({
  selector: 'app-anuncios',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './anuncios.html',
  styleUrls: ['./anuncios.css']
})
export class Anuncios implements OnInit {
  private readonly anunciosService = inject(AnunciosService);

  ultimaNovedad = signal<Anuncio | null>(null);
  anuncioSeleccionado = signal<Anuncio | null>(null);
  cargando = signal<boolean>(true);

  ngOnInit(): void {
    this.loadUltimaNovedad();
  }

  private loadUltimaNovedad(): void {
    this.cargando.set(true);

    this.anunciosService.getAnuncios().subscribe({
      next: (anuncios) => {
        
        const anunciosEstudiante = anuncios.filter((n) => {
          if (!n.dirigido_a) return true;
          const alcance = n.dirigido_a.toUpperCase();
          return (
            alcance === 'AMBOS' ||
            alcance === 'ESTUDIANTE' ||
            alcance === 'ALUMNOS' ||
            alcance === 'TODOS'
          );
        });

        this.ultimaNovedad.set(anunciosEstudiante[0] ?? null);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al obtener los anuncios:', err);
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

  getCategoryBadgeClass(alcance?: string): string {
    const base = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border';
    switch (alcance?.toUpperCase()) {
      case 'ESTUDIANTE':
      case 'ALUMNOS':
        return `${base} bg-blue-50 text-blue-700 border-blue-200`;
      case 'AMBOS':
      case 'TODOS':
        return `${base} bg-purple-50 text-purple-700 border-purple-200`;
      default:
        return `${base} bg-slate-50 text-slate-700 border-slate-200`;
    }
  }
}