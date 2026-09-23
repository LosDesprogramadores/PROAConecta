import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  UnidadMateria,
  ContenidoUnidad,
  MateriaPortada,
} from '../../../model/unidad-contenido.model';
import { IMateria } from '../../../model/materia.model';
import { UnidadesMaterial } from '../portada/unidades-material/unidades-material';
import { RecursosClaseComponent } from '../portada/recursos-clase/recursos-clase';
import { MateriaService } from '../../../services/materia.service';

@Component({
  selector: 'app-portada-profesor',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, UnidadesMaterial, RecursosClaseComponent],
  templateUrl: './portada-profesor.html',
  styleUrls: ['./portada-profesor.css'],
})
export class PortadaProfesor implements OnInit {
  @Input() materia?: MateriaPortada;

  cargando = signal<boolean>(false);
  error = signal<string | null>(null);

  materiaId: number | null = null;
  editandoDescripcion = signal<boolean>(false);
  tempDescripcion = '';
  unidadExpandida = signal<string | null>(null);

  mostrarFormularioUnidad = signal<boolean>(false);
  nuevoNombreUnidad = '';
  nuevoDescripcionUnidad = '';

  mostrarFormularioRecurso = signal<boolean>(false);
  nuevoTituloRecurso = '';
  nuevoTipoRecurso: 'documento' | 'video' | 'enlace' = 'documento';
  nuevoUrlRecurso = '';

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

  constructor(
    private readonly materiaService: MateriaService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.cargarMateriaDesdeRuta();
  }

  private cargarMateriaDesdeRuta(): void {
    this.route.parent?.paramMap.subscribe((params) => {
      const idParam = params.get('id');

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
      unidades: [
        {
          id: 'unidad-1',
          numero: 1,
          nombre: `Introducción a ${nombreMateria}`,
          descripcion: 'Conceptos fundamentales y generalidades',
          contenidos: [],
        },
        {
          id: 'unidad-2',
          numero: 2,
          nombre: 'Desarrollo Temático',
          descripcion: 'Unidad principal de estudio',
          contenidos: [],
        },
        {
          id: 'unidad-3',
          numero: 3,
          nombre: 'Aplicaciones Prácticas',
          descripcion: 'Ejercicios y casos de estudio',
          contenidos: [],
        },
      ],
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

  iniciarEdicionDescripcion(): void {
    this.tempDescripcion = this.datosActuales.presentacion;
    this.editandoDescripcion.set(true);
  }

  guardarDescripcion(): void {
    if (!this.materiaId) return;

    const materiaActualizada: IMateria = {
      titulo: this.datosActuales.nombre,
      descripcion: this.tempDescripcion.trim(),
      anio: this.datosActuales.anio,
      curso: this.datosActuales.curso,
    };

    this.materiaService.actualizarMateria(this.materiaId, materiaActualizada).subscribe({
      next: (materiaResponse) => {
        this.materia = this.convertirMateriaPortada(materiaResponse);
        this.editandoDescripcion.set(false);
      },
      error: (err) => {
        console.error('Error actualizando la descripción de la materia:', err);
        this.error.set('No se pudo guardar la descripción de la materia.');
      },
    });
  }

  cancelarEdicionDescripcion(): void {
    this.editandoDescripcion.set(false);
  }

  toggleUnidad(unidadId: string): void {
    if (this.unidadExpandida() === unidadId) {
      this.unidadExpandida.set(null);
    } else {
      this.unidadExpandida.set(unidadId);
    }
  }

  trackByUnidad(index: number, unidad: UnidadMateria): string {
    return unidad.id;
  }

  abrirFormularioUnidad(): void {
    this.mostrarFormularioUnidad.set(true);
    this.nuevoNombreUnidad = '';
    this.nuevoDescripcionUnidad = '';
  }

  cancelarFormularioUnidad(): void {
    this.mostrarFormularioUnidad.set(false);
  }

  guardarUnidad(): void {
    if (!this.nuevoNombreUnidad.trim()) {
      alert('El nombre de la unidad es requerido');
      return;
    }

    const unidades = this.datosActuales.unidades;
    const nuevaUnidad: UnidadMateria = {
      id: `unidad-${Date.now()}`,
      numero: unidades.length + 1,
      nombre: this.nuevoNombreUnidad.trim(),
      descripcion: this.nuevoDescripcionUnidad.trim() || undefined,
      contenidos: [],
    };

    unidades.push(nuevaUnidad);
    this.mostrarFormularioUnidad.set(false);
  }

  abrirFormularioRecurso(): void {
    this.mostrarFormularioRecurso.set(true);
    this.nuevoTituloRecurso = '';
    this.nuevoTipoRecurso = 'documento';
    this.nuevoUrlRecurso = '';
  }

  cancelarFormularioRecurso(): void {
    this.mostrarFormularioRecurso.set(false);
  }

  guardarRecurso(): void {
    if (!this.nuevoTituloRecurso.trim() || !this.nuevoUrlRecurso.trim()) {
      alert('Título y URL son requeridos');
      return;
    }

    if (!this.datosActuales.recursosClase) {
      this.datosActuales.recursosClase = [];
    }

    this.datosActuales.recursosClase.push({
      id: `recurso-${Date.now()}`,
      titulo: this.nuevoTituloRecurso,
      tipo: this.nuevoTipoRecurso,
      url: this.nuevoUrlRecurso,
      fechaCreacion: new Date(),
    });

    this.mostrarFormularioRecurso.set(false);
  }

  eliminarRecurso(id: string): void {
    if (confirm('¿Eliminar este recurso?')) {
      if (!this.datosActuales.recursosClase) return;
      this.datosActuales.recursosClase = this.datosActuales.recursosClase.filter(
        (r) => r.id !== id,
      );
    }
  }

  onContenidoGuardado(unidadId: string, contenido: ContenidoUnidad): void {
    const unidad = this.datosActuales.unidades.find((u) => u.id === unidadId);
    if (!unidad) return;

    const index = unidad.contenidos.findIndex((c) => c.id === contenido.id);
    if (index >= 0) {
      unidad.contenidos[index] = {
        ...contenido,
        fechaCreacion: unidad.contenidos[index].fechaCreacion,
      };
    } else {
      unidad.contenidos.push(contenido);
    }
  }

  onContenidoEliminado(unidadId: string, contenidoId: string): void {
    const unidad = this.datosActuales.unidades.find((u) => u.id === unidadId);
    if (!unidad) return;

    unidad.contenidos = unidad.contenidos.filter((c) => c.id !== contenidoId);
  }

  abrirModalActividad(): void {}

  abrirModalRecurso(): void {
    this.abrirFormularioRecurso();
  }
}