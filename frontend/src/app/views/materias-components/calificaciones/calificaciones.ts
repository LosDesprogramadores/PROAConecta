import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.model';

interface CalificacionEstudiante {
  id: number;
  actividad: string;
  fecha: string;
  calificacion: number;
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
  imports: [CommonModule],
  templateUrl: './calificaciones.html',
  styleUrl: './calificaciones.css',
})
export class Calificaciones {

  private authService = inject(AuthService);

  private currentUser = this.authService.currentUser;

  esDocente = computed(() =>
    this.currentUser()?.rolId === UserRole.DOCENTE
  );


  // =========================
  // ESTUDIANTE
  // =========================

  misCalificaciones = signal<CalificacionEstudiante[]>([
    {
      id: 1,
      actividad: 'Trabajo Práctico N°1',
      fecha: '20/08/2026',
      calificacion: 8
    },
    {
      id: 2,
      actividad: 'Trabajo Práctico N°2',
      fecha: '25/08/2026',
      calificacion: 9
    },
    {
      id: 3,
      actividad: 'Evaluación parcial',
      fecha: '27/08/2026',
      calificacion: 7
    }
  ]);


  promedio = computed(() => {

    const notas = this.misCalificaciones();

    if (notas.length === 0) {
      return 0;
    }

    const suma = notas.reduce(
      (total, item) => total + item.calificacion,
      0
    );

    return Number((suma / notas.length).toFixed(2));
  });


  // =========================
  // DOCENTE
  // =========================

  actividades = signal([
    'TP N°1',
    'TP N°2',
    'Parcial'
  ]);

  alumnos = signal<AlumnoCalificaciones[]>([
    {
      id: 1,
      nombre: 'Juan',
      apellido: 'Pérez',
      notas: [8, 9, 7]
    },
    {
      id: 2,
      nombre: 'María',
      apellido: 'Gómez',
      notas: [9, 8, 10]
    },
    {
      id: 3,
      nombre: 'Pedro',
      apellido: 'López',
      notas: [6, 7, 8]
    },
    {
      id: 4,
      nombre: 'Lucía',
      apellido: 'Fernández',
      notas: [10, 9, 9]
    }
  ]);


  actualizarNota(
    alumno: AlumnoCalificaciones,
    indice: number,
    event: Event
  ): void {

    const input = event.target as HTMLInputElement;

    const valor = Number(input.value);

    if (Number.isNaN(valor)) {
      return;
    }

    alumno.notas[indice] = valor;

    this.alumnos.update(lista => [...lista]);
  }


  guardarCalificaciones(): void {

    console.log(
      'Calificaciones a guardar:',
      this.alumnos()
    );

  }

}