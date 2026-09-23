import { Component, inject, OnInit, signal } from '@angular/core';
import { InscripcionesService } from '../../../../services/inscripciones.service';
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
  private readonly authServices = inject(AuthService);

  materias = signal<number>(0);
  cargando = signal<boolean>(true);

  ngOnInit(): void {
    this.cargarCantidadMaterias();
  }

  private cargarCantidadMaterias(): void {
    const usuario = this.authServices.getCurrentUser()?.id;
    
    if (usuario) {
      this.cargando.set(true); // Iniciamos la carga

      this.inscripcionServices.obtenerInscripcionesPorEstudiante(usuario).subscribe({
        next: (listaMaterias) => {
          this.materias.set(listaMaterias.length);
          this.cargando.set(false);
        },
        error: (err) => {
          console.error('Error al cargar materias:', err);
          this.cargando.set(false);
        }
      });
    } else {
      this.cargando.set(false);
    }
  }
}