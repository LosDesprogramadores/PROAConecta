import { Component, computed, inject, OnInit, signal } from '@angular/core';

import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

import { UserRole } from '../../../core/auth/auth.model';

import {
  CalificacionesService,
  RendimientoEstudiante,
} from '../../../services/calificaciones.service';

import { ToastService } from '../../../services/toast.service';

interface CalificacionEstudiante {
  id: number;
  actividad: string;
  calificacion: string | number | null;
  devolucion: string | null;
}

interface AlumnoCalificaciones {
  id: number;
  nombre: string;
  apellido: string;
  notas: number[];
}

@Component({
  selector: 'app-calificaciones',
  standalone: true,
  imports: [],
  templateUrl: './calificaciones.html',
  styleUrl: './calificaciones.css',
})
export class Calificaciones implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private calificacionesService = inject(CalificacionesService);
  private toastService = inject(ToastService);

  private currentUser = this.authService.currentUser;

  // *=========================*
  // *ROLES*
  // *=========================*

  esDocente = computed(() => this.currentUser()?.rolId === UserRole.DOCENTE);

  esEstudiante = computed(() => this.currentUser()?.rolId === UserRole.ESTUDIANTE);

  // *=========================*
  // *ESTUDIANTE*
  // *=========================*

  misCalificaciones = signal<CalificacionEstudiante[]>([]);
  promedio = signal<string | number | null>(null);

  materiaTitulo = signal('');
  curso = signal('');
  anio = signal<number | null>(null);
  nombreEstudiante = signal('');

  totalEvaluaciones = signal(0);

  cargando = signal(false);
  error = signal('');

  ngOnInit(): void {
    if (!this.esEstudiante()) {
      return;
    }

    /*
     * La ruta de calificaciones es hija de:
     *
     * view-materia/:id
     *
     * Por eso el parámetro "id" está en la ruta padre.
     */

    const materiaId = Number(this.route.parent?.snapshot.paramMap.get('id'));

    if (!materiaId) {
      this.error.set('No se pudo identificar la materia.');
      return;
    }

    this.cargarRendimiento(materiaId);
  }

  private cargarRendimiento(materiaId: number): void {
    this.cargando.set(true);
    this.error.set('');

    this.calificacionesService.obtenerMiRendimiento(materiaId).subscribe({
      next: (data: RendimientoEstudiante) => {
        this.materiaTitulo.set(data.materia_titulo);
        this.curso.set(data.curso);
        this.anio.set(data.anio);

        this.nombreEstudiante.set(data.estudiante?.nombre_completo ?? '');

        this.totalEvaluaciones.set(data.total_evaluaciones ?? 0);

        this.promedio.set(data.promedio);

        this.misCalificaciones.set(
          data.actividades.map((actividad) => ({
            id: actividad.actividad_id,
            actividad: actividad.titulo,
            calificacion: actividad.calificacion,
            devolucion: actividad.devolucion,
          })),
        );

        this.cargando.set(false);
      },

      error: (error) => {
        console.error('Error al cargar las calificaciones:', error);

        this.error.set('No se pudieron cargar las calificaciones de la materia.');

        this.cargando.set(false);
      },
    });
  }

  exportarPDF(): void {
    this.toastService.info('La exportación a PDF estará disponible próximamente.');
  }

  // *=========================*
  // *DOCENTE*
  // *=========================*

  actividades = signal(['TP N°1', 'TP N°2', 'Parcial']);

  alumnos = signal<AlumnoCalificaciones[]>([
    {
      id: 1,
      nombre: 'Juan',
      apellido: 'Pérez',
      notas: [8, 9, 7],
    },
    {
      id: 2,
      nombre: 'María',
      apellido: 'Gómez',
      notas: [9, 8, 10],
    },
    {
      id: 3,
      nombre: 'Pedro',
      apellido: 'López',
      notas: [6, 7, 8],
    },
    {
      id: 4,
      nombre: 'Lucía',
      apellido: 'Fernández',
      notas: [10, 9, 9],
    },
  ]);

  actualizarNota(alumno: AlumnoCalificaciones, indice: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const valor = Number(input.value);

    if (Number.isNaN(valor)) {
      return;
    }

    alumno.notas[indice] = valor;

    this.alumnos.update((lista) => [...lista]);
  }

  guardarCalificaciones(): void {
    console.log('Calificaciones a guardar:', this.alumnos());
  }
}
