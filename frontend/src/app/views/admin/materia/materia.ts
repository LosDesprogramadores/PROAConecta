import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { filter, switchMap } from 'rxjs';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IMateria } from '../../../model/materia.model';
import { MateriaService } from '../../../services/materia.service';
import { ToastService } from '../../../services/toast.service';
import { mensajeErrorCampo } from '../../../shared/utils/form-errors';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';


@Component( {
  selector: 'app-materia',
  standalone: true,
  imports: [ CommonModule, ReactiveFormsModule ],
  templateUrl: './materia.html'
} )
export class Materia implements OnInit {
  private materiaService = inject( MateriaService );
  private fb = inject( FormBuilder );
  private toastService = inject( ToastService );
  private confirmDialog = inject( ConfirmDialogService );

  materias = signal<IMateria[]>( [] );
  isModalOpen = signal<boolean>( false );
  isEditing = signal<boolean>( false );
  selectedId = signal<number | null>( null );
  isLoading = signal<boolean>( false );

  form: FormGroup = this.fb.group( {
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

  cargarMaterias(): void {
    this.isLoading.set( true );
    this.materiaService.obtenerMaterias().subscribe( {
      next: ( data ) => {
        this.materias.set( data );
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
        next: ( res ) => {
          this.materias.update( lista => [ ...lista, res ] );
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
        this.materias.update( lista => lista.filter( item => item.id !== id ) );
        this.toastService.success( 'Materia eliminada correctamente.' );
      },
      error: ( err ) => {
        console.error( 'Error al eliminar materia:', err );
        this.toastService.error( this.toastService.readable_message_extraction( err ) );
      }
    } );
  }

  consultar( materia: any ) {
    this.toastService.info( "La funcionalidad de consultar està en desarrollo." );
  }
  asignar( materia: any ) {
    this.toastService.info( "La funcionalidad de asignar està en desarrollo." );

  }
  inscribir( materia: any ) {
    this.toastService.info( "La funcionalidad de inscribir està en desarrollo." );

  }

}