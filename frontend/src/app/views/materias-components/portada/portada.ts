import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {UnidadMateria, ContenidoUnidad, MateriaPortada, RecursoClase,} from '../../../model/unidad-contenido.model';

import { IMateria } from '../../../model/materia.model';
import { IPersonaResumen } from '../../../model/Persona.model';

import { ContenidoUnidadComponent } from './contenido-unidad/contenido-unidad';
import { MateriaService } from '../../../services/materia.service';

import { UserRole } from '../../../core/auth/auth.model';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-portada',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ContenidoUnidadComponent],
  templateUrl: './portada.html',
  styleUrl: './portada.css',
})
export class Portada implements OnInit {
  @Input() materia?: MateriaPortada;

  cargando = signal<boolean>(false);
  error = signal<string | null>(null);

  private materiaId: number | null = null;

  private readonly ROL_PROFESOR = UserRole.DOCENTE;

  // ==========================================
  // ROL
  // ==========================================

  esDocente = signal<boolean>(false);

  // ==========================================
  // EDICIÓN DE PRESENTACIÓN
  // ==========================================

  editandoDescripcion = signal<boolean>(false);

  tempDescripcion = '';

  // ==========================================
  // UNIDAD ABIERTA
  // ==========================================

  unidadExpandida = signal<string | null>(null);

  // ==========================================
  // NUEVA UNIDAD
  // ==========================================

  mostrarFormularioUnidad = signal<boolean>(false);

  nuevoNombreUnidad = '';

  nuevoDescripcionUnidad = '';

  // ==========================================
  // NUEVO RECURSO
  // ==========================================

  mostrarFormularioRecurso = signal<boolean>(false);

  nuevoTituloRecurso = '';

  nuevoTipoRecurso: 'documento' | 'video' | 'enlace' = 'documento';

  nuevoUrlRecurso = '';

  // ==========================================
  // DATOS ACTUALES
  // ==========================================

  get datosActuales(): MateriaPortada {
    return (
      this.materia ?? {
        id: this.materiaId ?? undefined,
        nombre: 'Cargando...',
        docente: 'Sin profesor asignado',
        presentacion: 'Cargando información...',
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
    private readonly authService: AuthService,
  ) {}

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  ngOnInit(): void {
    this.detectarRol();
    this.cargarMateriaDesdeRuta();
  }

  // ==========================================
  // DETECTAR ROL
  // ==========================================

  private detectarRol(): void {
    const rolId = this.authService.rol();

    this.esDocente.set(rolId === this.ROL_PROFESOR);

    if (rolId === this.ROL_PROFESOR) {
      console.log('Usuario detectado como PROFESOR');
    } else if (rolId === UserRole.ESTUDIANTE) {
      console.log('Usuario detectado como ESTUDIANTE');
    } else {
      console.log('Usuario con rol:', rolId);
    }
  }

  // ==========================================
  // CARGAR MATERIA
  // ==========================================

  private cargarMateriaDesdeRuta(): void {
    /*
     * IMPORTANTE:
     *
     * La ruta está definida así:
     *
     * view-materia/:id
     *
     * y Portada está dentro de children.
     *
     * Por eso el parámetro :id pertenece al
     * ActivatedRoute padre.
     */

    const idParametro = this.route.parent?.snapshot.paramMap.get('id');

    console.log('ID recibido desde la ruta:', idParametro);

    if (!idParametro) {
      this.error.set('No se encontró el identificador de la materia.');
      return;
    }

    const id = Number(idParametro);

    if (Number.isNaN(id)) {
      this.error.set('El identificador de la materia no es válido.');
      return;
    }

    this.materiaId = id;

    this.cargando.set(true);
    this.error.set(null);

    console.log('Cargando materia con ID:', id);

    this.materiaService.obtenerMateriaPorId(id).subscribe({
      next: (materia: IMateria) => {
        console.log('Materia obtenida:', materia);

        this.materia = this.convertirMateriaPortada(materia);

        this.cargando.set(false);
      },

      error: (err) => {
        console.error('Error cargando la materia:', err);

        this.error.set('No se pudo cargar la información de la materia.');

        this.cargando.set(false);
      },
    });
  }

  // ==========================================
  // ADAPTADOR IMateria -> MateriaPortada
  // ==========================================

  private convertirMateriaPortada(materia: IMateria): MateriaPortada {
    return {
      id: materia.id,

      nombre: materia.titulo,

      presentacion: materia.descripcion ?? 'No hay una descripción disponible para esta materia.',

      anio: materia.anio,

      curso: materia.curso,

      docente: materia.profesor_detalle
        ? this.obtenerNombreProfesor(materia.profesor_detalle)
        : 'Sin profesor asignado',

      /*
       * Las unidades y recursos todavía se mantienen
       * locales hasta conectar sus respectivos servicios.
       */
      unidades: [],

      recursosClase: [],
    };
  }

  // ==========================================
  // OBTENER NOMBRE DEL PROFESOR
  // ==========================================

  private obtenerNombreProfesor(profesor: IPersonaResumen): string {
    if (!profesor) {
      return 'Sin profesor asignado';
    }

    if (profesor.nombre_completo) {
      return profesor.nombre_completo;
    }

    return `${profesor.nombre} ${profesor.apellido}`.trim();
  }

  // ==========================================
  // GESTIÓN PRESENTACIÓN
  // ==========================================

  iniciarEdicionDescripcion(): void {
    this.tempDescripcion = this.datosActuales.presentacion;

    this.editandoDescripcion.set(true);
  }

  guardarDescripcion(): void {
    this.datosActuales.presentacion = this.tempDescripcion;

    this.editandoDescripcion.set(false);

    console.log('Descripción modificada localmente.');
  }

  cancelarEdicionDescripcion(): void {
    this.editandoDescripcion.set(false);
  }

  // ==========================================
  // GESTIÓN UNIDADES
  // ==========================================

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

    const numeroNuevo = unidades.length + 1;

    const nuevaUnidad: UnidadMateria = {
      id: `unidad-${Date.now()}`,

      numero: numeroNuevo,

      nombre: this.nuevoNombreUnidad.trim(),

      descripcion: this.nuevoDescripcionUnidad.trim() || undefined,

      contenidos: [],
    };

    unidades.push(nuevaUnidad);

    console.log('Unidad creada localmente:', nuevaUnidad);

    this.mostrarFormularioUnidad.set(false);
  }

  // ==========================================
  // GESTIÓN RECURSOS
  // ==========================================

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
    if (!this.nuevoTituloRecurso.trim()) {
      alert('El título del recurso es requerido');
      return;
    }

    if (!this.nuevoUrlRecurso.trim()) {
      alert('La URL es requerida');
      return;
    }

    try {
      new URL(this.nuevoUrlRecurso);
    } catch {
      alert('Por favor ingresa una URL válida (ej: https://...)');
      return;
    }

    if (!this.datosActuales.recursosClase) {
      this.datosActuales.recursosClase = [];
    }

    const nuevoRecurso: RecursoClase = {
      id: `recurso-${Date.now()}`,

      titulo: this.nuevoTituloRecurso.trim(),

      tipo: this.nuevoTipoRecurso,

      url: this.nuevoUrlRecurso.trim(),

      fechaCreacion: new Date(),
    };

    this.datosActuales.recursosClase.push(nuevoRecurso);

    console.log('Recurso creado localmente:', nuevoRecurso);

    this.mostrarFormularioRecurso.set(false);
  }

  eliminarRecurso(id: string): void {
    if (!confirm('¿Eliminar este recurso?')) {
      return;
    }

    if (!this.datosActuales.recursosClase) {
      return;
    }

    const indice = this.datosActuales.recursosClase.findIndex((recurso) => recurso.id === id);

    if (indice >= 0) {
      this.datosActuales.recursosClase.splice(indice, 1);

      console.log('Recurso eliminado:', id);
    }
  }

  // ==========================================
  // GESTIÓN CONTENIDO
  // ==========================================

  onContenidoGuardado(unidadId: string, contenido: ContenidoUnidad): void {
    const unidad = this.datosActuales.unidades.find((unidad) => unidad.id === unidadId);

    if (!unidad) {
      return;
    }

    const indiceExistente = unidad.contenidos.findIndex(
      (contenidoActual) => contenidoActual.id === contenido.id,
    );

    if (indiceExistente >= 0) {
      const fechaOriginal = unidad.contenidos[indiceExistente].fechaCreacion;

      unidad.contenidos[indiceExistente] = {
        ...contenido,
        fechaCreacion: fechaOriginal,
      };

      console.log('Contenido actualizado:', contenido);
    } else {
      unidad.contenidos.push({
        ...contenido,
      });

      console.log('Contenido agregado:', contenido);
    }
  }

  onContenidoEliminado(unidadId: string, contenidoId: string): void {
    const unidad = this.datosActuales.unidades.find((unidad) => unidad.id === unidadId);

    if (!unidad) {
      return;
    }

    const indice = unidad.contenidos.findIndex((contenido) => contenido.id === contenidoId);

    if (indice >= 0) {
      unidad.contenidos.splice(indice, 1);

      console.log('Contenido eliminado:', contenidoId);
    }
  }

  // ==========================================
  // MÉTODOS LEGACY
  // ==========================================

  abrirModalActividad(): void {
    console.log('Abrir modal para crear actividad');
  }

  abrirModalRecurso(): void {
    this.abrirFormularioRecurso();
  }
}
