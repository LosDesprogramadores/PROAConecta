import { Component, Input, OnInit, SimpleChanges, inject, signal, OnChanges } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { MaterialesService } from '../../../../services/materiales.service';
import { Material } from '../../../../model/unidad-material.model';

import { Modal } from '../../../../shared/modal/modal';
import { ConfirmDialogService } from '../../../../services/confirm-dialog.service';
import { filter } from 'rxjs';
import { ArchivoProtegidoDirective } from '../../../../core/http/archivo-protegido.directive';
@Component({
  selector: 'app-recursos-clase',
  standalone: true,
  imports: [Modal, ReactiveFormsModule, ArchivoProtegidoDirective],
  templateUrl: './recursos-clase.html',
  styleUrl: './recursos-clase.css',
})
export class RecursosClaseComponent implements OnInit, OnChanges {
  @Input() materiaId: number | string | null = null;

  private materialesService = inject(MaterialesService);

  private confirmDialog = inject(ConfirmDialogService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private fb = inject(NonNullableFormBuilder);

  recursos = signal<Material[]>([]);
  cargando = signal(false);

  esDocente = signal(false);

  // ==============================
  // FORMULARIO
  // ==============================

  mostrarFormulario = signal(false);

  recursoEditandoId: number | string | null = null;

  readonly formulario = this.fb.group({
    tipo: 'DOCUMENTO',
    titulo: '',
    url: '',
    visible: true,
  });

  archivoSeleccionado: File | null = null;

  // ==============================
  // INICIALIZACIÓN
  // ==============================

  ngOnInit(): void {
    this.esDocente.set(this.authService.currentUser()?.rolNombre === 'Profesor');

    if (this.materiaId !== null && this.materiaId !== '') {
      this.cargarRecursos();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['materiaId'] && changes['materiaId'].currentValue) {
      this.materiaId = changes['materiaId'].currentValue;
      this.cargarRecursos();
    }
  }

  // ==============================
  // CARGAR RECURSOS
  // ==============================

  cargarRecursos(): void {
    if (this.materiaId === null || this.materiaId === '') {
      return;
    }

    this.cargando.set(true);

    this.materialesService.obtenerMaterialesGenerales(this.materiaId).subscribe({
      next: (data) => {
        this.recursos.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar recursos de la clase:', err);
        this.toastService.error('Error al cargar los recursos de la clase');
        this.cargando.set(false);
      },
    });
  }

  // ==============================
  // ABRIR FORMULARIO NUEVO
  // ==============================

  abrirFormularioRecurso(): void {
    this.recursoEditandoId = null;

    this.formulario.reset();

    this.archivoSeleccionado = null;

    this.mostrarFormulario.set(true);
  }

  // ==============================
  // EDITAR RECURSO
  // ==============================

  prepararEditarRecurso(material: Material): void {
    this.recursoEditandoId = material.id ?? null;

    this.formulario.setValue({
      tipo: material.tipo || 'DOCUMENTO',
      titulo: material.titulo || '',
      url: material.enlace || '',
      visible: material.visible ?? true,
    });

    this.archivoSeleccionado = null;

    this.mostrarFormulario.set(true);
  }

  // ==============================
  // ARCHIVO
  // ==============================

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      this.archivoSeleccionado = input.files[0];
    }
  }

  // ==============================
  // CANCELAR
  // ==============================

  cancelarFormularioRecurso(): void {
    this.mostrarFormulario.set(false);

    this.recursoEditandoId = null;
    this.archivoSeleccionado = null;

    this.formulario.reset();
  }

  // ==============================
  // GUARDAR / ACTUALIZAR
  // ==============================

  guardarRecurso(): void {
    if (this.materiaId === null || this.materiaId === '') {
      this.toastService.error('No se pudo identificar la materia');
      return;
    }

    const valores = this.formulario.getRawValue();

    if (!valores.titulo.trim()) {
      this.toastService.error('El título es requerido');
      return;
    }

    const url = valores.url.trim();

    if (!url && !this.archivoSeleccionado) {
      this.toastService.error('Debes ingresar una URL o seleccionar un archivo');
      return;
    }

    let urlFormateada = url;

    if (urlFormateada && !/^https?:\/\//i.test(urlFormateada)) {
      urlFormateada = `https://${urlFormateada}`;
    }

    const payload: Partial<Material> = {
      materia: this.materiaId,
      unidad: null,
      tipo: valores.tipo.toUpperCase(),
      titulo: valores.titulo.trim(),
      enlace: urlFormateada || undefined,
      visible: valores.visible,
    };

    // ==============================
    // ACTUALIZAR
    // ==============================

    if (this.recursoEditandoId !== null) {
      this.materialesService
        .actualizarMaterial(this.recursoEditandoId, payload, this.archivoSeleccionado || undefined)
        .subscribe({
          next: () => {
            this.toastService.success('Recurso actualizado correctamente');

            this.cargarRecursos();
            this.cancelarFormularioRecurso();
          },

          error: (err) => {
            console.error('Error al actualizar el recurso:', err);

            this.toastService.error('Error al actualizar el recurso');
          },
        });

      return;
    }

    // ==============================
    // CREAR
    // ==============================

    this.materialesService
      .crearMaterial(payload as Material, this.archivoSeleccionado || undefined)
      .subscribe({
        next: () => {
          this.toastService.success('Recurso agregado correctamente');

          this.cargarRecursos();
          this.cancelarFormularioRecurso();
        },

        error: (err) => {
          console.error('Error al guardar el recurso:', err);

          this.toastService.error('Error al guardar el recurso');
        },
      });
  }

  // ==============================
  // VISIBILIDAD
  // ==============================

  alternarVisibilidad(material: Material): void {
    if (!material.id) {
      return;
    }

    const estadoAnterior = material.visible;

    material.visible = !material.visible;

    this.materialesService.cambiarVisibilidadMaterial(material.id).subscribe({
      next: (res) => {
        material.visible = res.visible;

        this.recursos.update((lista) =>
          lista.map((m) => (m.id === material.id ? { ...m, visible: res.visible } : m)),
        );
      },

      error: (err) => {
        material.visible = estadoAnterior;

        console.error('Error al cambiar visibilidad:', err);

        this.toastService.error('No se pudo cambiar la visibilidad');
      },
    });
  }

  // ==============================
  // ELIMINAR
  // ==============================

  eliminarRecurso(material: Material): void {
    if (!material.id) {
      return;
    }
    const materialId = material.id;

    this.confirmDialog.confirmar('¿Estás seguro de que deseas eliminar este recurso?').pipe(filter(Boolean)).subscribe(() => {

    this.materialesService.eliminarMaterial(materialId).subscribe({
      next: () => {
        this.recursos.update((lista) => lista.filter((m) => m.id !== materialId));

        this.toastService.success('Recurso eliminado');
      },

      error: (err) => {
        console.error('Error al eliminar el recurso:', err);

        this.toastService.error('Error al eliminar el recurso');
      },
    });
    });
  }

  // ==============================
  // UTILIDADES
  // ==============================

  iconoTipo(tipo: string): string {
    switch (tipo) {
      case 'VIDEO':
        return '🎥';

      case 'DOCUMENTO':
        return '📄';

      case 'ENLACE':
        return '🔗';

      default:
        return '📎';
    }
  }

  tipoLabel(tipo: string): string {
    switch (tipo) {
      case 'VIDEO':
        return 'Video';

      case 'DOCUMENTO':
        return 'Documento';

      case 'ENLACE':
        return 'Enlace';

      default:
        return tipo;
    }
  }

  obtenerUrl(material: Material): string {
    return material.enlace || this.obtenerArchivoUrl(material.archivo);
  }

  private obtenerArchivoUrl(archivo: File | string | null | undefined): string {
    if (!archivo) {
      return '';
    }

    if (typeof archivo === 'string') {
      return archivo;
    }

    return URL.createObjectURL(archivo);
  }
}
