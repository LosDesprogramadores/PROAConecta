import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { filter, switchMap } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IMateria } from '../../../model/materia.model';
import { MateriaService } from '../../../services/materia.service';
import { ToastService } from '../../../services/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { ExportarListado } from '../../../shared/exportar-listado/exportar-listado';
import { environment } from '../../../../environments/environment';
import { mensajeErrorCampo } from '../../../shared/utils/form-errors';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { Paginador } from '../../../shared/paginador/paginador';


const TAMANO_PAGINA = 20;

@Component( {
  selector: 'app-materia',
  standalone: true,
  imports: [ Modal, CommonModule, ReactiveFormsModule, ExportarListado, Paginador ],
  templateUrl: './materia.html'
} )
export class Materia implements OnInit {
  private materiaService = inject( MateriaService );
  private fb = inject( FormBuilder );
  private toastService = inject( ToastService );
  private confirmDialog = inject( ConfirmDialogService );

  protected readonly urlExportarMaterias = `${environment.apiUrl}materias/exportar/`;
  materias = signal<IMateria[]>( [] );
  readonly tamanoPagina = TAMANO_PAGINA;
  total = signal<number>( 0 );
  pagina = signal<number>( 1 );
  isModalOpen = signal<boolean>( false );
  isEditing = signal<boolean>( false );
  selectedId = signal<number | null>( null );
  isLoading = signal<boolean>( false );

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- parameter kept: the template passes the row
  consultar( materia: any ) {
    this.toastService.info( "La funcionalidad de consultar està en desarrollo." );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- parameter kept: the template passes the row
  asignar( materia: any ) {
    this.toastService.info( "La funcionalidad de asignar està en desarrollo." );

  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- parameter kept: the template passes the row
  inscribir( materia: any ) {
    this.toastService.info( "La funcionalidad de inscribir està en desarrollo." );

  }

}