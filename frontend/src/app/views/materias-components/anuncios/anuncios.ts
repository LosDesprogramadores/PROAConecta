import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AnuncioMateria } from '../../../model/anuncio-materia.model';

@Component({
  selector: 'app-anuncios-materia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './anuncios.html',
  styleUrls: ['./anuncios.css']
})
export class AnunciosMateriaComponent implements OnInit {
  @Input() materiaId?: string;

  private router = inject(Router);

  // Signals
  anuncios = signal<AnuncioMateria[]>([]);
  filtroTexto = signal('');
  cargando = signal(true);

  ngOnInit() {
    this.cargarAnuncios();
  }

  cargarAnuncios() {
    // TODO: Llamar a la API para obtener los anuncios desde el backend
    setTimeout(() => {
      this.anuncios.set([
        {
          id: 1,
          titulo: '📌 Cronograma de exámenes finales - Diciembre 2026',
          autor: 'Coordinación Pedagógica',
          avatarUrl: undefined,
          fechaCreacion: new Date('2026-08-20'),
          ultimaRespuesta: {
            autor: 'Coordinación Pedagógica',
            fecha: new Date('2026-08-20'),
            avatarUrl: undefined
          },
          cantidadReplicas: 0,
          importante: true,
          bloqueado: true
        },
        {
          id: 2,
          titulo: 'Nuevo material de Unidad 4 disponible',
          autor: 'Prof. Carlos Mendoza',
          avatarUrl: undefined,
          fechaCreacion: new Date('2026-08-18'),
          ultimaRespuesta: {
            autor: 'Sofía Martínez',
            fecha: new Date('2026-08-21'),
            avatarUrl: undefined
          },
          cantidadReplicas: 3
        },
        {
          id: 3,
          titulo: 'Recordatorio: Entrega del TP2',
          autor: 'Prof. Marina Benítez',
          avatarUrl: undefined,
          fechaCreacion: new Date('2026-08-14'),
          ultimaRespuesta: {
            autor: 'Prof. Marina Benítez',
            fecha: new Date('2026-08-14'),
            avatarUrl: undefined
          },
          cantidadReplicas: 0
        },
        {
          id: 4,
          titulo: 'Cambio de horario clase sincrónica',
          autor: 'Prof. Carlos Mendoza',
          avatarUrl: undefined,
          fechaCreacion: new Date('2026-08-05'),
          ultimaRespuesta: {
            autor: 'Lucas Rossi',
            fecha: new Date('2026-08-06'),
            avatarUrl: undefined
          },
          cantidadReplicas: 2
        },
        {
          id: 5,
          titulo: '¡Bienvenidos al ciclo lectivo ProaConecta!',
          autor: 'Equipo Técnico PRoA',
          avatarUrl: undefined,
          fechaCreacion: new Date('2026-03-10'),
          ultimaRespuesta: {
            autor: 'Equipo Técnico PRoA',
            fecha: new Date('2026-03-10'),
            avatarUrl: undefined
          },
          cantidadReplicas: 0
        }
      ]);
      this.cargando.set(false);
    }, 500);
  }

  buscar(input: string | Event): void {
    const texto = typeof input === 'string'
      ? input
      : (input.target as HTMLInputElement).value;

    this.filtroTexto.set(texto);
  }

  anunciosFiltrados(): AnuncioMateria[] {
    const filtro = this.filtroTexto().toLowerCase();
    if (!filtro) {
      return this.anuncios();
    }
    return this.anuncios().filter(anuncio =>
      anuncio.titulo.toLowerCase().includes(filtro)
    );
  }

  abrirAnuncio(anuncio: AnuncioMateria): void {
    this.router.navigate(['/view-materia/anuncios', anuncio.id]);
  }

  formatearFecha(fecha: Date): string {
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    const fechaObj = new Date(fecha);

    if (fechaObj.toDateString() === hoy.toDateString()) {
      return fechaObj.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    if (fechaObj.toDateString() === ayer.toDateString()) {
      return 'Ayer';
    }

    return fechaObj.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  trackByAnuncioId(index: number, anuncio: AnuncioMateria): number {
    return anuncio.id;
  }
}