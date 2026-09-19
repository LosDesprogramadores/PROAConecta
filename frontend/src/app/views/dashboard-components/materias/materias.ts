import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

import { IMateria } from '../../../model/materia.model';
import { AuthService } from '../../../core/auth/auth.service';
import { InscripcionesService } from '../../../services/inscripciones.service';

@Component({
  selector: 'app-materias',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './materias.html',
  styleUrl: './materias.css',
})
export class Materias implements OnInit {
  materias = signal<IMateria[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

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
  ) {}

  ngOnInit(): void {
    this.cargarMaterias();
  }

  private cargarMaterias(): void {
    this.cargando.set(true);
    this.error.set(null);

    const usuario = this.authService.currentUser();
    const estudianteId = usuario?.persona?.id;

    console.log('Usuario autenticado:', usuario);
    console.log('ID del estudiante:', estudianteId);

    if (estudianteId === undefined || estudianteId === null) {
      this.error.set('No se pudo identificar al estudiante.');
      this.cargando.set(false);
      return;
    }

    this.inscripcionesService.obtenerInscripcionesPorEstudiante(estudianteId).subscribe({
      next: (inscripciones) => {
        const materias: IMateria[] = inscripciones.map((inscripcion) => ({
          id: inscripcion.materia,
          titulo: inscripcion.materia_titulo,
          curso: inscripcion.materia_curso,
          anio: inscripcion.materia_anio,
          descripcion: null,
          criterios_evaluacion: null,
          activo: true,
          profesor: null,
          profesor_detalle: null,
          total_estudiantes: undefined,
        }));

        this.materias.set(materias);
        this.cargando.set(false);

        console.log('Materias inscriptas del estudiante:', materias);
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

    return ['/view-materia', materia.id.toString(), 'portada'];
  }
}
