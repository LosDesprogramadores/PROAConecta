import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TemaForo } from '../../../model/tema-foro.model';

@Component({
  selector: 'app-foro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './foro.html',
  styleUrls: ['./foro.css']
})
export class ForoComponent implements OnInit {
  @Input() materiaId?: string;

  private router = inject(Router);
  
  // Signals
  temas = signal<TemaForo[]>([]);
  filtroTexto = signal('');
  cargando = signal(true);

  ngOnInit() {
    this.cargarTemas();
  }

  cargarTemas() {
    // TODO: Llamar a la API para obtener los temas del foro desde el backend
    setTimeout(() => {
      this.temas.set([
        {
          id: 1,
          titulo: '📌 REGISTRO OBLIGATORIO: Presentación de Proyectos Finales 2026',
          autor: 'Coordinación Pedagógica',
          avatarUrl: undefined,
          fechaCreacion: new Date('2026-08-15'),
          ultimaRespuesta: {
            autor: 'Coordinación Pedagógica',
            fecha: new Date('2026-08-15'),
            avatarUrl: undefined
          },
          cantidadReplicas: 0,
          importante: true,
          bloqueado: true
        },
        {
          id: 2,
          titulo: 'Espacio de consultas: Unidad 3 - Arquitectura en Angular y Signals',
          autor: 'Prof. Carlos Mendoza',
          avatarUrl: undefined,
          fechaCreacion: new Date('2026-08-10'),
          ultimaRespuesta: {
            autor: 'Sofía Martínez',
            fecha: new Date('2026-08-22'),
            avatarUrl: undefined
          },
          cantidadReplicas: 8
        },
        {
          id: 3,
          titulo: 'Enlace a la clase sincrónica de repaso - Modelo Relacional vs NoSQL',
          autor: 'Prof. Marina Benítez',
          avatarUrl: undefined,
          fechaCreacion: new Date('2026-08-05'),
          ultimaRespuesta: {
            autor: 'Prof. Marina Benítez',
            fecha: new Date('2026-08-05'),
            avatarUrl: undefined
          },
          cantidadReplicas: 0
        },
        {
          id: 4,
          titulo: 'Debate: ¿Cuál es la mejor estrategia para la gestión de estados?',
          autor: 'Lucas Rossi',
          avatarUrl: undefined,
          fechaCreacion: new Date('2026-07-28'),
          ultimaRespuesta: {
            autor: 'Valentina Gómez',
            fecha: new Date('2026-08-18'),
            avatarUrl: undefined
          },
          cantidadReplicas: 14
        },
        {
          id: 5,
          titulo: 'Taller Práctico: Despliegue de contenedores con Docker y Nginx',
          autor: 'Prof. Carlos Mendoza',
          avatarUrl: undefined,
          fechaCreacion: new Date('2026-07-15'),
          ultimaRespuesta: {
            autor: 'Mateo Torres',
            fecha: new Date('2026-07-20'),
            avatarUrl: undefined
          },
          cantidadReplicas: 5
        },
        {
          id: 6,
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

  temasFiltrados(): TemaForo[] {
    const filtro = this.filtroTexto().toLowerCase();
    if (!filtro) {
      return this.temas();
    }
    return this.temas().filter(tema =>
      tema.titulo.toLowerCase().includes(filtro)
    );
  }

  abrirTema(tema: TemaForo): void {
    this.router.navigate(['/view-materia/foro', tema.id]);
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

  trackByTemaId(index: number, tema: TemaForo): number {
    return tema.id;
  }
}