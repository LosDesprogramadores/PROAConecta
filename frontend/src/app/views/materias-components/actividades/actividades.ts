import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.model';

interface Actividad {
  id: number;
  titulo: string;
  descripcion: string;
  materia: string;
  fechaLimite: string;
  estado: 'Pendiente' | 'Entregada' | 'Vencida';
}

@Component({
  selector: 'app-actividades',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './actividades.html',
  styleUrl: './actividades.css',
})
export class Actividades {

  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;

  esEstudiante = computed(() =>
    this.currentUser()?.rolId === UserRole.ESTUDIANTE
  );

  esDocente = computed(() =>
    this.currentUser()?.rolId === UserRole.DOCENTE
  );

  actividades = signal<Actividad[]>([
    {
      id: 1,
      titulo: 'Trabajo Práctico N° 1',
      descripcion: 'Resolución de ejercicios sobre funciones y ecuaciones.',
      materia: 'Matemática I',
      fechaLimite: '30/08/2026',
      estado: 'Pendiente'
    },
    {
      id: 2,
      titulo: 'Análisis de texto',
      descripcion: 'Realizar un análisis sintáctico del texto trabajado en clase.',
      materia: 'Lengua',
      fechaLimite: '02/09/2026',
      estado: 'Pendiente'
    },
    {
      id: 3,
      titulo: 'Introducción a la programación',
      descripcion: 'Resolver las actividades correspondientes a la unidad 2.',
      materia: 'Programación',
      fechaLimite: '25/08/2026',
      estado: 'Entregada'
    },
    {
      id: 4,
      titulo: 'Revolución Industrial',
      descripcion: 'Investigar las principales consecuencias sociales y económicas.',
      materia: 'Historia',
      fechaLimite: '20/08/2026',
      estado: 'Vencida'
    }
  ]);

  actividadesPendientes = computed(() =>
    this.actividades().filter(a => a.estado === 'Pendiente')
  );

  actividadesEntregadas = computed(() =>
    this.actividades().filter(a => a.estado === 'Entregada')
  );

  nuevaActividad(): void {
    console.log('Crear nueva actividad');
  }

  verActividad(actividad: Actividad): void {
    console.log('Ver actividad:', actividad);
  }
}