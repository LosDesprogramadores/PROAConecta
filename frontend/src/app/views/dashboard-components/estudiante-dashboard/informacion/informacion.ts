import { Component, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { InscripcionesService } from '../../../../services/inscripciones.service';
import { ActividadesService } from '../../../../services/actividades.service'; // Ajusta la ruta a tu servicio
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-informacion',
  standalone: true,
  imports: [],
  templateUrl: './informacion.html',
  styleUrl: './informacion.css',
})
export class Informacion implements OnInit {
  private readonly inscripcionServices = inject(InscripcionesService);
  private readonly actividadesService = inject(ActividadesService);
  private readonly authServices = inject(AuthService);

  materias = signal<number>(0);
  actividades = signal<number>(0);
  cargando = signal<boolean>(true);

  ngOnInit(): void {
    this.cargarInformacion();
  }

  private cargarInformacion(): void {
    const usuarioId = this.authServices.getCurrentUser()?.id;

    if (!usuarioId) {
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);

    // Consultamos en paralelo materias y actividades
    forkJoin({
      materias: this.inscripcionServices.obtenerInscripcionesPorEstudiante(usuarioId),
      actividades: this.actividadesService.getActividades()
    }).subscribe({
      next: (res) => {
        this.materias.set(res.materias.length);
        this.actividades.set(res.actividades.length);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar la información del dashboard:', err);
        this.cargando.set(false);
      }
    });
  }
}