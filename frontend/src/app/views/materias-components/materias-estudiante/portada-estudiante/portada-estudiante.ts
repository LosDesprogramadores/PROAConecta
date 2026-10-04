import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MateriaPortada } from '../../../../model/unidad-contenido.model';
import { IMateria } from '../../../../model/materia.model';
import { UnidadesMaterial } from '../../portada/unidades-material/unidades-material';
import { RecursosClaseComponent } from '../../portada/recursos-clase/recursos-clase';
import { MateriaService } from '../../../../services/materia.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserRole } from '../../../../core/auth/auth.model';

@Component({
  selector: 'app-portada-estudiante',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, UnidadesMaterial, RecursosClaseComponent],
  templateUrl: './portada-estudiante.html',
  styleUrls: ['./portada-estudiante.css'],
})
export class PortadaEstudiante implements OnInit {
  @Input() materia?: MateriaPortada;

  private authService = inject(AuthService);
  private materiaService = inject(MateriaService);
  private route = inject(ActivatedRoute);

  currentUser = this.authService.currentUser;

  esDocente = computed(() =>
    this.currentUser()?.rolId === UserRole.DOCENTE
  );

  cargando = signal<boolean>(false);
  error = signal<string | null>(null);

  materiaId: number | null = null;

  mostrarTextoCompleto = signal<boolean>(false);

  get datosActuales(): MateriaPortada {
    return (
      this.materia || {
        nombre: 'Cargando...',
        docente: 'Cargando profesor...',
        presentacion: 'Cargando información de la materia...',
        anio: 0,
        curso: '',
        unidades: [],
        recursosClase: [],
      }
    );
  }

  ngOnInit(): void {
    this.cargarMateriaDesdeRuta();
  }

  toggleMostrarTexto(): void {
    this.mostrarTextoCompleto.update((v) => !v);
  }

  private obtenerMateriaIdDesdeArbol(): string | null {
    let currentRoute: ActivatedRoute | null = this.route;
    while (currentRoute) {
      const id = currentRoute.snapshot.paramMap.get('id');
      if (id) {
        return id;
      }
      currentRoute = currentRoute.parent;
    }
    return null;
  }

  private cargarMateriaDesdeRuta(): void {
    const idParam = this.obtenerMateriaIdDesdeArbol();

    if (!idParam) {
      this.error.set('No se encontró el identificador de la materia.');
      return;
    }

    const id = Number(idParam);

    if (Number.isNaN(id)) {
      this.error.set('El identificador de la materia no es válido.');
      return;
    }

    this.materiaId = id;
    this.cargando.set(true);
    this.error.set(null);

    this.materiaService.obtenerMateriaPorId(id).subscribe({
      next: (materiaResponse) => {
        this.materia = this.convertirMateriaPortada(materiaResponse);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error cargando la materia:', err);
        this.error.set('No se pudo cargar la materia.');
        this.cargando.set(false);
      },
    });
  }

  private convertirMateriaPortada(materia: IMateria): MateriaPortada {
    const nombreMateria = materia.titulo || 'Materia';
    const nombreProfesor = this.obtenerNombreProfesor(materia.profesor_detalle);

    return {
      nombre: nombreMateria,
      presentacion:
        materia.descripcion ||
        `Esta materia introduce los conceptos fundamentales de ${nombreMateria}.`,
      docente: nombreProfesor,
      anio: materia.anio,
      curso: materia.curso,
      unidades: [],
      recursosClase: [],
    };
  }

  private obtenerNombreProfesor(profesor: any): string {
    if (!profesor) {
      return 'Profesor Titular';
    }
    if (profesor.nombre && profesor.apellido) {
      return `${profesor.nombre} ${profesor.apellido}`;
    }
    return (
      profesor.nombre_completo || profesor.nombre || profesor.apellido_nombre || 'Profesor Titular'
    );
  }
}