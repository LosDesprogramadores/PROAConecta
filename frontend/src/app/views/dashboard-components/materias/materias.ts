import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterModule } from '@angular/router';

import { IMateria, IInscripcion } from '../../../model/materia.model';
import { AuthService } from '../../../core/auth/auth.service';
import { InscripcionesService } from '../../../services/inscripciones.service';

interface IMateriaConInscripcion extends IMateria {
  fecha_inscripcion?: string;
  anio_lectivo?: number;
}

@Component({
  selector: 'app-materias',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './materias.html',
  styleUrl: './materias.css',
})
export class Materias implements OnInit {
  materias = signal<IMateriaConInscripcion[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

  // Filtro de año: 'actual' o 'todas'
  filtroAnio = signal<'actual' | 'todas'>('actual');
  anioActual = new Date().getFullYear();

  // Computada que aplica el filtro dinámicamente
  materiasFiltradas = computed(() => {
    const lista = this.materias();
    if (this.filtroAnio() === 'todas') {
      return lista;
    }

    return lista.filter((materia) => {
      // Si la fecha de inscripción tiene el año actual
      if (materia.fecha_inscripcion) {
        const anioInscripcion = new Date(materia.fecha_inscripcion).getFullYear();
        if (anioInscripcion === this.anioActual) return true;
      }

      // Si tiene año lectivo explícito
      if (materia.anio_lectivo === this.anioActual) {
        return true;
      }

      // De lo contrario, por defecto muestra todas si no hay metadato de fecha
      return true;
    });
  });

  private readonly colores = [
    'bg-red-300',
    'bg-blue-300',
    'bg-green-300',
    'bg-yellow-300',
    'bg-purple-300',
    'bg-pink-300',
    'bg-teal-300',
  ];

  constructor(
    private readonly inscripcionesService: InscripcionesService,
    private readonly authService: AuthService,
  ) { }

  ngOnInit(): void {
    this.cargarMaterias();
  }

  cambiarFiltro(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.filtroAnio.set(selectElement.value as 'actual' | 'todas');
  }

  private cargarMaterias(): void {
    this.cargando.set(true);
    this.error.set(null);

    const usuario = this.authService.currentUser();
    const estudianteId = usuario?.persona?.id;

    if (estudianteId === undefined || estudianteId === null) {
      this.error.set('No se pudo identificar al estudiante.');
      this.cargando.set(false);
      return;
    }

    this.inscripcionesService.obtenerInscripcionesPorEstudiante(estudianteId).subscribe({
      next: (inscripciones: IInscripcion[]) => {
        const materiasMapped: IMateriaConInscripcion[] = inscripciones.map((inscripcion) => ({
          id: inscripcion.materia,
          titulo: inscripcion.materia_titulo,
          curso: inscripcion.materia_curso,
          anio: inscripcion.materia_anio,
          fecha_inscripcion: inscripcion.fecha_inscripcion,
          anio_lectivo: inscripcion.fecha_inscripcion ? new Date(inscripcion.fecha_inscripcion).getFullYear() : undefined,
          descripcion: null,
          criterios_evaluacion: null,
          activo: true,
          profesor: null,
          profesor_detalle: null,
          total_estudiantes: undefined,
        }));

        this.materias.set(materiasMapped);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error cargando materias del estudiante:', err);
        this.error.set('No se pudieron cargar tus materias.');
        this.cargando.set(false);
      },
    });
  }

  obtenerColor(index: number): string {
    return this.colores[index % this.colores.length];
  }

  obtenerPath(materia: IMateria): string[] {
    if (materia.id === undefined || materia.id === null) {
      return ['/dashboard/materias'];
    }

    return ['/view-materia', materia.id.toString()];
  }
}