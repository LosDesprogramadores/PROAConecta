import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { InscripcionesService } from '../../../services/inscripciones.service';
import { IMateria } from '../../../model/materia.model';
import { AuthService } from '../../../core/auth/auth.service';

interface Noticia {
  fecha: string;
  hora: string;
  titulo: string;
  autor: string;
  contenido: string;
}

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.css'],
})
export class Welcome implements OnInit {
  materias = signal<IMateria[]>([]);
  noticias = signal<Noticia[]>([]);

  cargando = signal(false);
  error = signal<string | null>(null);

  expandedMaterias = signal(false);
  readonly itemsToShow = 3;

  constructor(
    private readonly inscripcionesService: InscripcionesService,
    private readonly authService: AuthService,
  ) {}

  userName = computed(() => {
    const persona = this.authService.currentUser()?.persona;
    if (!persona) return 'Estudiante';
    return `${persona.nombre} ${persona.apellido}`;
  });

  ngOnInit(): void {
    this.loadMateriasEstudiante();
    this.loadNoticias();
  }

  private loadMateriasEstudiante(): void {
    this.cargando.set(true);
    this.error.set(null);

    const usuario = this.authService.currentUser();
    const personaId = usuario?.persona?.id;

    if (!personaId) {
      this.error.set('No se pudo identificar a la persona asociada.');
      this.cargando.set(false);
      return;
    }

    this.inscripcionesService.obtenerInscripcionesPorEstudiante(personaId).subscribe({
      next: (inscripciones) => {
        const materias: IMateria[] = inscripciones.map((inscripcion) => ({
          id: inscripcion.materia,
          titulo: inscripcion.materia_titulo,
          descripcion: null,
          criterios_evaluacion: null,
          anio: inscripcion.materia_anio,
          curso: inscripcion.materia_curso,
          activo: true,
          profesor: null,
          profesor_detalle: null,
          total_estudiantes: undefined,
        }));

        this.materias.set(materias);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error cargando materias del estudiante:', err);
        this.error.set('No se pudieron cargar tus materias.');
        this.cargando.set(false);
      },
    });
  }

  private loadNoticias(): void {
    this.noticias.set([
      {
        fecha: '20/08/2026',
        hora: '08:00',
        titulo: 'Inicio del ciclo lectivo',
        autor: 'Dirección',
        contenido: 'El ciclo lectivo comienza oficialmente el lunes 24 de agosto.',
      },
    ]);
  }

  get materiasVisibles(): IMateria[] {
    if (this.expandedMaterias()) {
      return this.materias();
    }
    return this.materias().slice(0, this.itemsToShow);
  }

  get tieneMasMaterias(): boolean {
    return this.materias().length > this.itemsToShow;
  }

  toggleExpandMaterias(): void {
    this.expandedMaterias.update((value) => !value);
  }
}