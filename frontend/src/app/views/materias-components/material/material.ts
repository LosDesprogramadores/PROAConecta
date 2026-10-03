import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.model';
import { ToastService } from '../../../services/toast.service';
import { MaterialesService } from '../../../services/materiales.service';
import { Material as MaterialModel } from '../../../model/unidad-material.model';

@Component({
  selector: 'app-material',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './material.html',
  styleUrl: './material.css',
})
export class Material implements OnInit {
  private authService = inject(AuthService);
  private materialesService = inject(MaterialesService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);

  private currentUser = this.authService.currentUser;

  esDocente = computed(() => this.currentUser()?.rolId === UserRole.DOCENTE);

  materiaId: number | null = null;

  cargando = signal<boolean>(false);
  private todos = signal<MaterialModel[]>([]);

  // El profesor ve todo (incluso lo oculto); el estudiante solo lo visible
  materiales = computed(() =>
    this.esDocente() ? this.todos() : this.todos().filter(m => m.visible !== false)
  );

  // ESTADO DEL FORMULARIO
  mostrarFormulario = signal<boolean>(false);
  materialEditandoId: number | string | null = null;
  archivoSeleccionado: File | null = null;
  nuevoTipo = 'DOCUMENTO';
  nuevoTitulo = '';
  nuevaDescripcion = '';
  nuevoUrl = '';
  nuevoVisible = true;

  ngOnInit(): void {
    let materiaIdParam: string | null = null;
    for (const route of this.route.pathFromRoot) {
      if (route.snapshot.paramMap.has('id')) {
        materiaIdParam = route.snapshot.paramMap.get('id');
        break;
      }
    }

    const id = Number(materiaIdParam);
    if (!id || Number.isNaN(id)) {
      this.toastService.error('No se encontró la materia');
      return;
    }

    this.materiaId = id;
    this.cargarMateriales();
  }

  cargarMateriales(): void {
    if (this.materiaId === null) return;

    this.cargando.set(true);
    this.materialesService.obtenerMaterialesGenerales(this.materiaId).subscribe({
      next: (data) => {
        this.todos.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.toastService.error('Error al cargar los materiales');
        this.cargando.set(false);
      },
    });
  }

  // Devuelve la URL para abrir el material (archivo subido o enlace)
  urlDe(material: MaterialModel): string | null {
    const archivo = material.archivo;
    if (typeof archivo === 'string' && archivo) return archivo;
    return material.enlace || null;
  }

  // --- FORMULARIO ---

  subirMaterial(): void {
    this.materialEditandoId = null;
    this.nuevoTipo = 'DOCUMENTO';
    this.nuevoTitulo = '';
    this.nuevaDescripcion = '';
    this.nuevoUrl = '';
    this.nuevoVisible = true;
    this.archivoSeleccionado = null;
    this.mostrarFormulario.set(true);
  }

  editarMaterial(material: MaterialModel): void {
    this.materialEditandoId = material.id ?? null;
    this.nuevoTipo = material.tipo || 'DOCUMENTO';
    this.nuevoTitulo = material.titulo || '';
    this.nuevaDescripcion = material.descripcion || '';
    this.nuevoUrl = material.enlace || '';
    this.nuevoVisible = material.visible ?? true;
    this.archivoSeleccionado = null;
    this.mostrarFormulario.set(true);
  }

  cancelarFormulario(): void {
    this.mostrarFormulario.set(false);
    this.materialEditandoId = null;
    this.archivoSeleccionado = null;
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.archivoSeleccionado = input.files[0];
    }
  }

  guardarMaterial(): void {
    if (this.materiaId === null) return;
    if (!this.nuevoTitulo.trim()) {
      this.toastService.error('El título es obligatorio');
      return;
    }

    let urlFormateada = this.nuevoUrl.trim();
    if (urlFormateada && !/^https?:\/\//i.test(urlFormateada)) {
      urlFormateada = `https://${urlFormateada}`;
    }

    // Al crear, tiene que haber un enlace o un archivo
    if (!this.materialEditandoId && !urlFormateada && !this.archivoSeleccionado) {
      this.toastService.error('Cargá un enlace o subí un archivo');
      return;
    }

    const payload: Partial<MaterialModel> = {
      materia: this.materiaId,
      tipo: this.nuevoTipo.toUpperCase(),
      titulo: this.nuevoTitulo.trim(),
      descripcion: this.nuevaDescripcion.trim() || undefined,
      enlace: urlFormateada || undefined,
      visible: this.nuevoVisible,
    };

    if (this.materialEditandoId) {
      this.materialesService
        .actualizarMaterial(this.materialEditandoId, payload, this.archivoSeleccionado || undefined)
        .subscribe({
          next: () => {
            this.toastService.success('Material actualizado correctamente');
            this.cargarMateriales();
            this.cancelarFormulario();
          },
          error: () => this.toastService.error('Error al actualizar el material'),
        });
    } else {
      this.materialesService
        .crearMaterial(payload, this.archivoSeleccionado || undefined)
        .subscribe({
          next: () => {
            this.toastService.success('Material agregado correctamente');
            this.cargarMateriales();
            this.cancelarFormulario();
          },
          error: () => this.toastService.error('Error al guardar el material'),
        });
    }
  }

  // --- ACCIONES ---

  alternarVisibilidad(material: MaterialModel): void {
    if (!material.id) return;

    this.materialesService.cambiarVisibilidadMaterial(material.id).subscribe({
      next: (res) => {
        this.todos.update(lista =>
          lista.map(m => (m.id === material.id ? { ...m, visible: res.visible } : m))
        );
        this.toastService.success(res.mensaje);
      },
      error: () => this.toastService.error('Error al cambiar la visibilidad'),
    });
  }

  eliminarMaterial(material: MaterialModel): void {
    if (!material.id) return;
    if (!confirm('¿Estás seguro de que deseas eliminar este material?')) return;

    this.materialesService.eliminarMaterial(material.id).subscribe({
      next: () => {
        this.todos.update(lista => lista.filter(m => m.id !== material.id));
        this.toastService.success('Material eliminado');
      },
      error: () => this.toastService.error('Error al eliminar el material'),
    });
  }
}