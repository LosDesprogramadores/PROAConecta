import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { filter, finalize, forkJoin, switchMap } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IAlumnoMateria, IMateria } from '../../../model/materia.model';
import { MateriaService } from '../../../services/materia.service';
import { ProfesorService } from '../../../services/profesor.service';
import { EstudianteService } from '../../../services/estudiante.service';
import { InscripcionesService } from '../../../services/inscripciones.service';
import { Persona } from '../../../model/Persona.model';
import { ToastService } from '../../../services/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { ExportarListado } from '../../../shared/exportar-listado/exportar-listado';
import { environment } from '../../../../environments/environment';
import { mensajeErrorCampo } from '../../../shared/utils/form-errors';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { Paginador } from '../../../shared/paginador/paginador';

const TAMANO_PAGINA = 20;
/** Mirrors the backend MAXIMO_ESTUDIANTES_POR_LOTE. */
export const MAXIMO_ESTUDIANTES_POR_LOTE = 200;

@Component( {
  selector: 'app-materia',
  standalone: true,
  imports: [Modal, ReactiveFormsModule, ExportarListado, Paginador],
  templateUrl: './materia.html'
} )
export class Materia implements OnInit {
  private materiaService = inject( MateriaService );
  private fb = inject( FormBuilder );
  private toastService = inject( ToastService );
  private confirmDialog = inject( ConfirmDialogService );
  private profesorService = inject( ProfesorService );
  private estudianteService = inject( EstudianteService );
  private inscripcionesService = inject( InscripcionesService );

  protected readonly urlExportarMaterias = `${environment.apiUrl}materias/exportar/`;
  materias = signal<IMateria[]>( [] );
  readonly tamanoPagina = TAMANO_PAGINA;
  total = signal<number>( 0 );
  pagina = signal<number>( 1 );
  isModalOpen = signal<boolean>( false );
  isEditing = signal<boolean>( false );
  selectedId = signal<number | null>( null );
  isLoading = signal<boolean>( false );

  materiaConsultada = signal<IMateria | null>( null );
  alumnosConsulta = signal<IAlumnoMateria[]>( [] );
  isLoadingConsulta = signal<boolean>( false );
  errorConsulta = signal<boolean>( false );

  // Asignar profesor
  materiaParaAsignar = signal<IMateria | null>( null );
  profesoresDisponibles = signal<Persona[]>( [] );
  profesorElegidoId = signal<number | null>( null );
  isLoadingProfesores = signal<boolean>( false );
  errorProfesores = signal<boolean>( false );
  guardandoAsignacion = signal<boolean>( false );

  // Inscribir estudiantes
  materiaParaInscribir = signal<IMateria | null>( null );
  estudiantesDisponibles = signal<Persona[]>( [] );
  estudiantesSeleccionados = signal<number[]>( [] );
  filtroEstudiantes = signal<string>( '' );
  isLoadingEstudiantes = signal<boolean>( false );
  isGuardando = signal<boolean>( false );
  errorEstudiantes = signal<boolean>( false );
  readonly limiteLote = MAXIMO_ESTUDIANTES_POR_LOTE;
  excedeLimite = computed( () => this.estudiantesSeleccionados().length > MAXIMO_ESTUDIANTES_POR_LOTE );

  todosSeleccionados = computed( () => {
    const seleccionados = this.estudiantesSeleccionados();
    const filtrados = this.estudiantesFiltrados();
    return filtrados.length > 0 && filtrados.every( e => seleccionados.includes( e.id ) );
  } );

  estudiantesFiltrados = computed( () => {
    const texto = this.filtroEstudiantes().trim().toLowerCase();
    const todos = this.estudiantesDisponibles();
    if ( !texto ) return todos;
    return todos.filter( e => `${e.apellido} ${e.nombre} ${e.email}`.toLowerCase().includes( texto ) );
  } );

  form = this.fb.nonNullable.group( {
    titulo: [ '', [ Validators.required, Validators.maxLength( 150 ) ] ],
    curso: [ '', [ Validators.required, Validators.maxLength( 20 ) ] ],
    anio: [ new Date().getFullYear(), [ Validators.required, Validators.min( 2000 ) ] ],
    descripcion: [ '' ],
    criterios_evaluacion: [ '' ],
    discord_webhook_url: [ '', [ Validators.maxLength( 500 ), Validators.pattern( /^(https:\/\/(discord|discordapp)\.com\/api\/webhooks\/.+)?$/ ) ] ]
  } );

  protected errorCampo( campo: string ): string | null {
    return mensajeErrorCampo( this.form.get( campo ), { pattern: 'Ingrese una URL válida de webhook de Discord.', min: 'El año debe ser 2000 o posterior.' } );
  }

  ngOnInit(): void {
    this.cargarMaterias();
  }

  /** Loads one server page. A page that emptied out (last row deleted) falls back to the previous one. */
  cargarMaterias( pagina: number = this.pagina() ): void {
    this.isLoading.set( true );
    this.materiaService.listarPaginado( { page: pagina, page_size: TAMANO_PAGINA } ).subscribe( {
      next: ( respuesta ) => {
        if ( respuesta.results.length === 0 && pagina > 1 ) {
          this.cargarMaterias( pagina - 1 );
          return;
        }
        this.materias.set( respuesta.results );
        const abierta = this.materiaConsultada();
        if ( abierta ) {
          const fresca = respuesta.results.find( m => m.id === abierta.id );
          if ( fresca ) this.materiaConsultada.set( fresca );
        }
        this.total.set( respuesta.count );
        this.pagina.set( pagina );
        this.isLoading.set( false );
      },
      error: ( err ) => {
        console.error( 'Error al cargar materias:', err );
        this.toastService.error( this.toastService.readable_message_extraction( err ) );
        this.isLoading.set( false );
      }
    } );
  }

  openCreateModal(): void {
    this.isEditing.set( false );
    this.selectedId.set( null );
    this.form.reset( {
      anio: new Date().getFullYear()
    } );
    this.isModalOpen.set( true );
  }

  openEditModal( materia: IMateria ): void {
    this.isEditing.set( true );
    this.selectedId.set( materia.id ?? null );
    this.form.patchValue( {
      titulo: materia.titulo,
      curso: materia.curso,
      anio: materia.anio,
      descripcion: materia.descripcion ?? '',
      criterios_evaluacion: materia.criterios_evaluacion ?? '',
      discord_webhook_url: materia.discord_webhook_url ?? ''
    } );
    this.isModalOpen.set( true );
  }

  closeModal(): void {
    this.isModalOpen.set( false );
    this.form.reset();
  }

  save(): void {
    if ( this.form.invalid ) {
      this.form.markAllAsTouched();
      return;
    }

    const formValues = this.form.getRawValue();
    const id = this.selectedId();

    if ( this.isEditing() && id !== null ) {
      const materiaActualizada: IMateria = { ...formValues, id };
      this.materiaService.actualizarMateria( id, materiaActualizada ).subscribe( {
        next: ( res ) => {
          this.materias.update( lista =>
            lista.map( item => item.id === id ? res : item )
          );
          this.closeModal();
        },
        error: ( err ) => {
          console.error( 'Error al actualizar materia:', err );
          this.toastService.error( this.toastService.readable_message_extraction( err ) );
        }
      } );
    } else {
      const nuevaMateria: IMateria = { ...formValues };
      this.materiaService.crearMateria( nuevaMateria ).subscribe( {
        next: () => {
          // Jump to the last page: that is where the new row appears.
          this.cargarMaterias(Math.max(1, Math.ceil((this.total() + 1) / TAMANO_PAGINA)));
          this.closeModal();
        },
        error: ( err ) => {
          console.error( 'Error al registrar materia:', err );
          this.toastService.error( this.toastService.readable_message_extraction( err ) );
        }
      } );
    }
  }

  eliminar( id: number | undefined ): void {
    if ( !id ) return;

    this.confirmDialog.confirmar( {
      titulo: 'Eliminar materia',
      mensaje: '¿Estás seguro de eliminar esta materia?',
      textoConfirmar: 'Sí, eliminar'
    } ).pipe(
      filter( confirmado => confirmado ),
      switchMap( () => this.materiaService.eliminarMateria( id ) )
    ).subscribe( {
      next: () => {
        this.cargarMaterias();
        this.toastService.success( 'Materia eliminada correctamente.' );
      },
      error: ( err ) => {
        console.error( 'Error al eliminar materia:', err );
        this.toastService.error( this.toastService.readable_message_extraction( err ) );
      }
    } );
  }

  /** Opens the panel below the table with the titular professor and the enrolled students; a second click closes it. */
  consultar( materia: IMateria ): void {
    if ( !materia.id ) return;
    if ( this.materiaConsultada()?.id === materia.id ) {
      this.cerrarConsulta();
      return;
    }

    this.materiaConsultada.set( materia );
    this.cargarAlumnosConsulta( materia.id );
  }

  private cargarAlumnosConsulta( id: number ): void {
    this.alumnosConsulta.set( [] );
    this.errorConsulta.set( false );
    this.isLoadingConsulta.set( true );

    this.materiaService.obtenerAlumnos( id ).subscribe( {
      next: ( alumnos ) => {
        if ( this.materiaConsultada()?.id !== id ) return;
        this.alumnosConsulta.set( alumnos );
        this.isLoadingConsulta.set( false );
      },
      error: ( err ) => {
        console.error( 'Error al consultar los estudiantes de la materia:', err );
        if ( this.materiaConsultada()?.id !== id ) return;
        this.errorConsulta.set( true );
        this.isLoadingConsulta.set( false );
      }
    } );
  }

  cerrarConsulta(): void {
    this.materiaConsultada.set( null );
    this.alumnosConsulta.set( [] );
    this.errorConsulta.set( false );
    this.isLoadingConsulta.set( false );
  }

  // ---- Asignar profesor titular ----

  asignar( materia: IMateria ): void {
    this.materiaParaAsignar.set( materia );
    this.profesorElegidoId.set( null );
    this.guardandoAsignacion.set( false );
    this.cargarProfesores( materia );
  }

  reintentarProfesores(): void {
    const materia = this.materiaParaAsignar();
    if ( materia ) this.cargarProfesores( materia );
  }

  private cargarProfesores( materia: IMateria ): void {
    this.profesoresDisponibles.set( [] );
    this.errorProfesores.set( false );
    this.isLoadingProfesores.set( true );

    this.profesorService.obtenerProfesores().subscribe( {
      next: ( profesores ) => {
        this.profesoresDisponibles.set( profesores.filter( p => p.id !== materia.profesor ) );
        this.isLoadingProfesores.set( false );
      },
      error: ( err ) => {
        console.error( 'Error al cargar profesores:', err );
        this.errorProfesores.set( true );
        this.isLoadingProfesores.set( false );
      }
    } );
  }

  elegirProfesor( id: number ): void {
    this.profesorElegidoId.set( id );
  }

  guardarAsignacion(): void {
    const materia = this.materiaParaAsignar();
    const profesorId = this.profesorElegidoId();
    if ( !materia?.id || profesorId === null || this.guardandoAsignacion() ) return;

    // The backend replaces the titular, so there is no need to unassign first.
    this.guardandoAsignacion.set( true );
    this.materiaService.asignarProfesorAMaterias( profesorId, [ materia.id ] ).pipe(
      finalize( () => this.guardandoAsignacion.set( false ) )
    ).subscribe( {
      next: () => {
        this.toastService.success( 'Profesor asignado correctamente.' );
        this.cerrarModalAsignar();
        this.cargarMaterias();
      },
      error: ( err ) => {
        console.error( 'Error al asignar el profesor:', err );
        this.toastService.error( this.toastService.readable_message_extraction( err ) );
      }
    } );
  }

  quitarTitular(): void {
    const materia = this.materiaParaAsignar();
    if ( !materia?.id || this.guardandoAsignacion() ) return;

    this.guardandoAsignacion.set( true );
    this.materiaService.desasignarProfesor( materia.id ).pipe(
      finalize( () => this.guardandoAsignacion.set( false ) )
    ).subscribe( {
      next: () => {
        this.toastService.success( 'Profesor desasignado correctamente.' );
        this.cerrarModalAsignar();
        this.cargarMaterias();
      },
      error: ( err ) => {
        console.error( 'Error al desasignar el profesor:', err );
        this.toastService.error( this.toastService.readable_message_extraction( err ) );
      }
    } );
  }

  cerrarModalAsignar(): void {
    this.materiaParaAsignar.set( null );
    this.profesorElegidoId.set( null );
  }

  // ---- Inscribir estudiantes ----

  inscribir( materia: IMateria ): void {
    if ( !materia.id ) return;
    this.materiaParaInscribir.set( materia );
    this.estudiantesSeleccionados.set( [] );
    this.filtroEstudiantes.set( '' );
    this.cargarEstudiantes( materia.id );
  }

  reintentarEstudiantes(): void {
    const id = this.materiaParaInscribir()?.id;
    if ( id ) this.cargarEstudiantes( id );
  }

  private cargarEstudiantes( id: number ): void {
    this.estudiantesDisponibles.set( [] );
    this.errorEstudiantes.set( false );
    this.isLoadingEstudiantes.set( true );

    // Available = everyone without a current (non-BAJA) enrolment; obtenerAlumnos already leaves BAJA out.
    forkJoin( {
      estudiantes: this.estudianteService.obtenerEstudiates(),
      inscriptos: this.materiaService.obtenerAlumnos( id )
    } ).subscribe( {
      next: ( { estudiantes, inscriptos } ) => {
        const ocupados = new Set( inscriptos.map( a => a.persona_id ) );
        this.estudiantesDisponibles.set( estudiantes.filter( e => !ocupados.has( e.id ) ) );
        this.isLoadingEstudiantes.set( false );
      },
      error: ( err ) => {
        console.error( 'Error al cargar estudiantes:', err );
        this.errorEstudiantes.set( true );
        this.isLoadingEstudiantes.set( false );
      }
    } );
  }

  toggleEstudiante( id: number ): void {
    this.estudiantesSeleccionados.update( actuales =>
      actuales.includes( id ) ? actuales.filter( i => i !== id ) : [ ...actuales, id ]
    );
  }

  /** Selects every student that matches the filter, or clears them when all are already selected. */
  seleccionarTodosEstudiantes(): void {
    const ids = this.estudiantesFiltrados().map( e => e.id );
    const seleccionados = this.estudiantesSeleccionados();
    const todos = ids.length > 0 && ids.every( id => seleccionados.includes( id ) );
    this.estudiantesSeleccionados.set( todos ? seleccionados.filter( id => !ids.includes( id ) ) : [ ...new Set( [ ...seleccionados, ...ids ] ) ] );
  }

  guardarInscripcion(): void {
    const materia = this.materiaParaInscribir();
    const ids = this.estudiantesSeleccionados();
    const materiaId = materia?.id;
    if ( !materiaId || ids.length === 0 || ids.length > MAXIMO_ESTUDIANTES_POR_LOTE || this.isGuardando() ) return;

    this.isGuardando.set( true );
    this.inscripcionesService.inscribirEstudiantesEnMateria( materiaId, ids ).subscribe( {
      next: ( respuesta ) => {
        this.isGuardando.set( false );
        this.toastService.success( `Se inscribió a ${respuesta.cantidad} ${respuesta.cantidad === 1 ? 'estudiante' : 'estudiantes'}.` );
        if ( respuesta.omitidos.length > 0 ) {
          this.toastService.warning( `${respuesta.omitidos.length} ${respuesta.omitidos.length === 1 ? 'estudiante ya estaba inscripto y fue omitido' : 'estudiantes ya estaban inscriptos y fueron omitidos'}.` );
        }
        this.cerrarModalInscribir();
        this.cargarMaterias();
        if ( this.materiaConsultada()?.id === materiaId ) this.cargarAlumnosConsulta( materiaId );
      },
      error: ( err ) => {
        console.error( 'Error al inscribir estudiantes:', err );
        this.isGuardando.set( false );
        this.toastService.error( this.toastService.readable_message_extraction( err ) );
      }
    } );
  }

  cerrarModalInscribir(): void {
    this.materiaParaInscribir.set( null );
    this.estudiantesSeleccionados.set( [] );
    this.filtroEstudiantes.set( '' );
  }
}
