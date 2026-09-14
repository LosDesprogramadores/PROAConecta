import {
  Component,
  Input,
  OnInit,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  ActivatedRoute,
  RouterModule
} from '@angular/router';

import { FormsModule } from '@angular/forms';

import {
  UnidadMateria,
  ContenidoUnidad,
  MateriaPortada,
  RecursoClase
} from '../../../model/unidad-contenido.model';

import { ContenidoUnidadComponent } from './contenido-unidad/contenido-unidad';

import { MateriaService } from '../../../services/materia.service';
import { UserRole } from '../../../core/auth/auth.model';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-portada',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ContenidoUnidadComponent
  ],
  templateUrl: './portada.html',
  styleUrl: './portada.css',
})
export class Portada implements OnInit {

  @Input() materia?: MateriaPortada;

  cargando = signal(false);

  error = signal<string | null>(null);

  private materiaId: number | null = null;

  // ID del rol profesor (AJUSTA SEGÚN TU BD)
  // Si en tu BD profesor = 1, coloca 1
  // Si es 2, coloca 2, etc.
  

  // ==========================================
  // DATOS DEMO
  // ==========================================

  materiaDemo: MateriaPortada = {

    nombre: 'Matemática I',

    docente: 'Prof. Carlos Scarpatti',

    presentacion:
      'Esta materia introduce los conceptos básicos de álgebra y geometría, con aplicaciones prácticas en la vida cotidiana y profesional.',

    unidades: [

      {
        id: 'unidad-1',

        numero: 1,

        nombre: 'Números reales y operaciones',

        descripcion:
          'Fundamentos de números reales y operaciones básicas',

        contenidos: [

          {
            id: 'contenido-1',

            titulo: 'Guía de Números Reales',

            descripcion:
              'Documento completo sobre números reales',

            tipo: 'documento',

            url:
              'https://drive.google.com/file/d/EJEMPLO/view',

            fechaCreacion:
              new Date('2026-09-01'),

          },

          {
            id: 'contenido-2',

            titulo: 'Tutorial en Video',

            descripcion:
              'Explicación de operaciones',

            tipo: 'video',

            url:
              'https://www.youtube.com/watch?v=dQw4w9WgXcQ',

            fechaCreacion:
              new Date('2026-09-02'),

          }

        ]

      },

      {

        id: 'unidad-2',

        numero: 2,

        nombre: 'Álgebra básica',

        descripcion:
          'Conceptos fundamentales de álgebra',

        contenidos: []

      },

      {

        id: 'unidad-3',

        numero: 3,

        nombre: 'Funciones y gráficas',

        descripcion:
          'Estudio de funciones y representación gráfica',

        contenidos: []

      },

      {

        id: 'unidad-4',

        numero: 4,

        nombre: 'Geometría analítica',

        descripcion:
          'Geometría en el plano cartesiano',

        contenidos: []

      }

    ],

    recursosClase: []

  }; private readonly ROL_PROFESOR = UserRole.DOCENTE;

  // ==========================================
  // ROL (Detectado automáticamente)
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

  mostrarFormularioUnidad =
    signal<boolean>(false);

  nuevoNombreUnidad = '';

  nuevoDescripcionUnidad = '';

  // ==========================================
  // NUEVO RECURSO
  // ==========================================

  mostrarFormularioRecurso =
    signal<boolean>(false);

  nuevoTituloRecurso = '';

  nuevoTipoRecurso: 'documento' | 'video' | 'enlace' = 'documento';

  nuevoUrlRecurso = '';

  // ==========================================
  // DATOS ACTUALES
  // ==========================================

  get datosActuales(): MateriaPortada {

    return this.materia || this.materiaDemo;

  }

  constructor(
    private readonly materiaService: MateriaService,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService
  ) {}

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  ngOnInit(): void {

    // Detectar rol del usuario autenticado
    this.detectarRol();

    this.cargarMateriaDesdeRuta();

  }

  // ==========================================
  // DETECTAR ROL
  // ==========================================

  private detectarRol(): void {

    const rolId = this.authService.rol();

    // Si el usuario está logueado y es profesor
    if (rolId === this.ROL_PROFESOR) {

      this.esDocente.set(true);

      console.log('Usuario detectado como PROFESOR');

    } else {

      this.esDocente.set(false);

      console.log('Usuario detectado como ESTUDIANTE');

    }

  }

  // ==========================================
  // CARGAR MATERIA
  // ==========================================

  private cargarMateriaDesdeRuta(): void {

    const idParametro =
      this.route.snapshot.paramMap.get('id');

    if (!idParametro) {

      this.error.set(
        'No se encontró el identificador de la materia.'
      );

      return;

    }

    const id = Number(idParametro);

    if (Number.isNaN(id)) {

      this.error.set(
        'El identificador de la materia no es válido.'
      );

      return;

    }

    this.materiaId = id;

    this.cargando.set(true);

    this.error.set(null);

    this.materiaService
      .obtenerMateriaPorId(id)
      .subscribe({

        next: (materia) => {

          this.materia = this.convertirMateriaPortada(
            materia
          );

          this.cargando.set(false);

        },

        error: (err) => {

          console.error(
            'Error cargando la materia:',
            err
          );

          this.error.set(
            'No se pudo cargar la materia.'
          );

          this.cargando.set(false);

        }

      });

  }

  // ==========================================
  // ADAPTADOR IMateria -> MateriaPortada
  // ==========================================

  private convertirMateriaPortada(
    materia: any
  ): MateriaPortada {

    /*
     * El backend actual nos entrega los datos
     * propios de IMateria.
     *
     * Las unidades/contenidos todavía no tienen
     * un endpoint disponible en el frontend que
     * nos hayas pasado, por eso conservamos las
     * unidades demo hasta que esa parte del backend
     * esté implementada.
     */

    return {

      ...this.materiaDemo,

      nombre: materia.titulo,

      presentacion:
        materia.descripcion ||
        'No hay una descripción disponible para esta materia.',

      docente:
        materia.profesor_detalle
          ? this.obtenerNombreProfesor(
              materia.profesor_detalle
            )
          : this.materiaDemo.docente

    };

  }

  private obtenerNombreProfesor(
    profesor: any
  ): string {

    if (!profesor) {
      return this.materiaDemo.docente;
    }

    return (
      profesor.nombre_completo ||
      profesor.nombre ||
      profesor.apellido_nombre ||
      this.materiaDemo.docente
    );

  }

  // ==========================================
  // GESTIÓN PRESENTACIÓN
  // ==========================================

  iniciarEdicionDescripcion(): void {

    this.tempDescripcion =
      this.datosActuales.presentacion;

    this.editandoDescripcion.set(true);

  }

  guardarDescripcion(): void {

    this.datosActuales.presentacion =
      this.tempDescripcion;

    this.editandoDescripcion.set(false);

    console.log(
      'Descripción guardada localmente.'
    );

    /*
     * TODO:
     * conectar actualización con backend
     * cuando corresponda.
     */

  }

  cancelarEdicionDescripcion(): void {

    this.editandoDescripcion.set(false);

  }

  // ==========================================
  // GESTIÓN UNIDADES
  // ==========================================

  toggleUnidad(unidadId: string): void {

    if (
      this.unidadExpandida() === unidadId
    ) {

      this.unidadExpandida.set(null);

    } else {

      this.unidadExpandida.set(unidadId);

    }

  }

  trackByUnidad(
    index: number,
    unidad: UnidadMateria
  ): string {

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

      alert(
        'El nombre de la unidad es requerido'
      );

      return;

    }

    const unidades =
      this.datosActuales.unidades;

    const numeroNuevo =
      (unidades.length || 0) + 1;

    const nuevaUnidad: UnidadMateria = {

      id: `unidad-${Date.now()}`,

      numero: numeroNuevo,

      nombre:
        this.nuevoNombreUnidad.trim(),

      descripcion:
        this.nuevoDescripcionUnidad.trim() ||
        undefined,

      contenidos: []

    };

    unidades.push(nuevaUnidad);

    console.log(
      'Unidad creada localmente:',
      nuevaUnidad
    );

    this.mostrarFormularioUnidad.set(false);

    /*
     * TODO:
     * Guardar en backend cuando exista
     * el endpoint correspondiente.
     */

  }

  // ==========================================
  // GESTIÓN RECURSOS DE CLASE
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

    // Inicializar array si no existe
    if (!this.datosActuales.recursosClase) {

      this.datosActuales.recursosClase = [];

    }

    const nuevoRecurso: RecursoClase = {

      id: `recurso-${Date.now()}`,

      titulo: this.nuevoTituloRecurso,

      tipo: this.nuevoTipoRecurso,

      url: this.nuevoUrlRecurso,

      fechaCreacion: new Date()

    };

    this.datosActuales.recursosClase.push(nuevoRecurso);

    console.log('Recurso creado:', nuevoRecurso);

    this.mostrarFormularioRecurso.set(false);

    /*
     * TODO:
     * Guardar en backend cuando corresponda.
     */

  }

  eliminarRecurso(id: string): void {

    if (confirm('¿Eliminar este recurso?')) {

      if (!this.datosActuales.recursosClase) {
        return;
      }

      const indice = this.datosActuales
        .recursosClase
        .findIndex(r => r.id === id);

      if (indice >= 0) {

        this.datosActuales.recursosClase.splice(
          indice,
          1
        );

        console.log('Recurso eliminado:', id);

      }

    }

  }

  // ==========================================
  // GESTIÓN CONTENIDO
  // ==========================================

  onContenidoGuardado(
    unidadId: string,
    contenido: ContenidoUnidad
  ): void {

    const unidad =
      this.datosActuales.unidades.find(
        u => u.id === unidadId
      );

    if (!unidad) {
      return;
    }

    const indiceExistente =
      unidad.contenidos.findIndex(
        c => c.id === contenido.id
      );

    if (indiceExistente >= 0) {

      const fechaOriginal =
        unidad.contenidos[
          indiceExistente
        ].fechaCreacion;

      unidad.contenidos[
        indiceExistente
      ] = {

        ...contenido,

        fechaCreacion:
          fechaOriginal

      };

      console.log(
        'Contenido actualizado:',
        contenido
      );

    } else {

      unidad.contenidos.push({
        ...contenido
      });

      console.log(
        'Contenido agregado:',
        contenido
      );

    }

  }

  onContenidoEliminado(
    unidadId: string,
    contenidoId: string
  ): void {

    const unidad =
      this.datosActuales.unidades.find(
        u => u.id === unidadId
      );

    if (!unidad) {
      return;
    }

    const indice =
      unidad.contenidos.findIndex(
        c => c.id === contenidoId
      );

    if (indice >= 0) {

      unidad.contenidos.splice(
        indice,
        1
      );

      console.log(
        'Contenido eliminado:',
        contenidoId
      );

    }

  }

  // ==========================================
  // MÉTODOS LEGACY
  // ==========================================

  abrirModalActividad(): void {

    console.log(
      'Abrir modal para crear actividad'
    );

  }

  abrirModalRecurso(): void {

    this.abrirFormularioRecurso();

  }

}