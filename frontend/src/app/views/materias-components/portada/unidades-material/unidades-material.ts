import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { UnidadesService } from '../../../../services/unidades.service';
import { MaterialesService } from '../../../../services/materiales.service';
import { Unidad, Material } from '../../../../model/unidad-material.model';

@Component({
  selector: 'app-unidades-material',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: './unidades-material.html',
  styleUrl: './unidades-material.css',
})
export class UnidadesMaterial implements OnInit {
  private unidadesService = inject(UnidadesService);
  private materialesService = inject(MaterialesService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);

  unidades = signal<Unidad[]>([]);
  esDocente = signal<boolean>(false);
  unidadExpandida = signal<string | number | null>(null);
  mostrarFormularioUnidad = signal(false);

  // ESTADO DE UNIDADES
  unidadEditandoId: string | number | null = null;
  nuevoNombreUnidad = '';
  nuevoDescripcionUnidad = '';
  nuevoOrdenUnidad: number = 1;
  materiaId: string | number = '';
  visible = true;

  // ESTADO DE RECURSOS / MATERIALES
  mostrarFormularioRecurso = signal<boolean>(false);
  unidadSeleccionadaId = signal<string | number | null>(null);
  recursoEditandoId: string | number | null = null;
  archivoSeleccionado: File | null = null;
  nuevoTipoRecurso = 'DOCUMENTO';
  nuevoTituloRecurso = '';
  nuevoUrlRecurso = '';
  nuevoMaterialVisible = true;

  ngOnInit() {
    this.esDocente.set(this.authService.currentUser()?.rolNombre === 'Profesor');

    this.materiaId = this.route.snapshot.paramMap.get('id')
      ?? this.route.parent?.snapshot.paramMap.get('id')
      ?? '';

    if (this.materiaId) {
      this.cargarUnidades();
    }
  }

  cargarUnidades() {
    this.unidadesService.obtenerUnidadesPorMateria(this.materiaId).subscribe({
      next: (data) => this.unidades.set(data),
      error: () => this.toastService.error('Error al cargar las unidades')
    });
  }

  toggleUnidad(id: string | number) {
    if (this.unidadExpandida() === id) {
      this.unidadExpandida.set(null);
      return;
    }

    this.unidadExpandida.set(id);
    this.cargarMaterialesDeUnidad(id);
  }

  cargarMaterialesDeUnidad(unidadId: string | number) {
    this.materialesService.obtenerMaterialesPorUnidad(unidadId).subscribe({
      next: (materiales) => {
        this.unidades.update(lista =>
          lista.map(u => u.id === unidadId ? { ...u, contenidos: materiales } : u)
        );
      },
      error: () => this.toastService.error('Error al cargar materiales de la unidad')
    });
  }

  // --- LÓGICA DE UNIDADES ---

  abrirFormularioUnidad() {
    this.unidadEditandoId = null;
    this.nuevoNombreUnidad = '';
    this.nuevoDescripcionUnidad = '';
    this.nuevoOrdenUnidad = 1;
    this.visible = true;
    this.mostrarFormularioUnidad.set(true);
  }

  prepararEditarUnidad(unidad: Unidad, event: Event) {
    event.stopPropagation();
    this.unidadEditandoId = unidad.id ?? null;
    this.nuevoNombreUnidad = unidad.titulo;
    this.nuevoDescripcionUnidad = unidad.descripcion || '';
    this.nuevoOrdenUnidad = unidad.orden ?? 1;
    this.visible = unidad.visible ?? true;
    this.mostrarFormularioUnidad.set(true);
  }

  cancelarFormularioUnidad() {
    this.mostrarFormularioUnidad.set(false);
    this.unidadEditandoId = null;
    this.nuevoNombreUnidad = '';
    this.nuevoDescripcionUnidad = '';
    this.nuevoOrdenUnidad = 1;
    this.visible = true;
  }

  guardarUnidad() {
    if (!this.nuevoNombreUnidad.trim()) return;

    const payload = {
      materia: this.materiaId,
      titulo: this.nuevoNombreUnidad,
      descripcion: this.nuevoDescripcionUnidad,
      orden: Number(this.nuevoOrdenUnidad) || 1,
      visible: this.visible
    };

    if (this.unidadEditandoId) {
      this.unidadesService.actualizarUnidad(this.unidadEditandoId, payload).subscribe({
        next: () => {
          this.toastService.success('Unidad actualizada correctamente');
          this.cargarUnidades();
          this.cancelarFormularioUnidad();
        },
        error: () => this.toastService.error('Error al actualizar la unidad')
      });
    } else {
      this.unidadesService.crearUnidad(payload).subscribe({
        next: () => {
          this.toastService.success('Unidad creada correctamente');
          this.cargarUnidades();
          this.cancelarFormularioUnidad();
        },
        error: () => this.toastService.error('Error al crear la unidad')
      });
    }
  }

  cambiarVisibilidad(unidadId: string | number, event: Event) {
    event.stopPropagation();

    this.unidadesService.cambiarVisibilidadUnidad(unidadId).subscribe({
      next: (res) => {
        this.toastService.success(res.mensaje);
        this.cargarUnidades();
      },
      error: () => this.toastService.error('Error al cambiar la visibilidad')
    });
  }

  eliminarUnidad(unidadId: string | number, event: Event) {
    event.stopPropagation();

    if (confirm('¿Estás seguro de eliminar esta unidad y sus contenidos?')) {
      this.unidadesService.eliminarUnidad(unidadId).subscribe({
        next: () => {
          this.toastService.success('Unidad enviada a la papelera');
          this.cargarUnidades();
        },
        error: () => this.toastService.error('Error al eliminar la unidad')
      });
    }
  }

  // --- LÓGICA DE RECURSOS / MATERIALES ---

  abrirFormularioRecurso(unidadId: string | number, event?: Event) {
    if (event) event.stopPropagation();
    this.unidadSeleccionadaId.set(unidadId);
    this.recursoEditandoId = null;
    this.nuevoTipoRecurso = 'DOCUMENTO';
    this.nuevoTituloRecurso = '';
    this.nuevoUrlRecurso = '';
    this.nuevoMaterialVisible = true;
    this.archivoSeleccionado = null;
    this.mostrarFormularioRecurso.set(true);
  }

  prepararEditarRecurso(material: Material, event?: Event) {
    if (event) event.stopPropagation();
    this.recursoEditandoId = material.id ?? null;
    this.unidadSeleccionadaId.set(material.unidad ?? null);
    this.nuevoTipoRecurso = material.tipo || 'DOCUMENTO';
    this.nuevoTituloRecurso = material.titulo || '';
    this.nuevoUrlRecurso = material.enlace || '';
    this.nuevoMaterialVisible = material.visible ?? true;
    this.archivoSeleccionado = null;
    this.mostrarFormularioRecurso.set(true);
  }

  onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.archivoSeleccionado = input.files[0];
    }
  }

  cancelarFormularioRecurso() {
    this.mostrarFormularioRecurso.set(false);
    this.unidadSeleccionadaId.set(null);
    this.recursoEditandoId = null;
    this.archivoSeleccionado = null;
  }

  guardarRecurso() {
    const unidadId = this.unidadSeleccionadaId();
    if (!this.nuevoTituloRecurso.trim()) return;

    let urlFormateada = this.nuevoUrlRecurso.trim();
    if (urlFormateada && !/^https?:\/\//i.test(urlFormateada)) {
      urlFormateada = `https://${urlFormateada}`;
    }

    const payload: Partial<Material> = {
      materia: this.materiaId,
      unidad: unidadId || undefined,
      tipo: this.nuevoTipoRecurso.toUpperCase(),
      titulo: this.nuevoTituloRecurso,
      enlace: urlFormateada || undefined,
      visible: this.nuevoMaterialVisible
    };

    if (this.recursoEditandoId) {
      // ✏️ ACTUALIZAR RECURSO
      this.materialesService.actualizarMaterial(
        this.recursoEditandoId, 
        payload, 
        this.archivoSeleccionado || undefined
      ).subscribe({
        next: () => {
          this.toastService.success('Recurso actualizado correctamente');
          if (unidadId) this.cargarMaterialesDeUnidad(unidadId);
          this.cancelarFormularioRecurso();
        },
        error: () => this.toastService.error('Error al actualizar el recurso')
      });
    } else {
      // ➕ CREAR RECURSO
      this.materialesService.crearMaterial(
        payload as Material, 
        this.archivoSeleccionado || undefined
      ).subscribe({
        next: () => {
          this.toastService.success('Recurso agregado correctamente');
          if (unidadId) this.cargarMaterialesDeUnidad(unidadId);
          this.cancelarFormularioRecurso();
        },
        error: () => this.toastService.error('Error al guardar el recurso')
      });
    }
  }

  alternarVisibilidadMaterial(material: Material): void {
    if (!material.id) return;
    const estadoAnterior = material.visible;
    material.visible = !material.visible;

    this.materialesService.cambiarVisibilidadMaterial(material.id).subscribe({
      next: (res) => {
        material.visible = res.visible;
      },
      error: (err) => {
        material.visible = estadoAnterior;
        console.error('Error al cambiar la visibilidad del material', err);
      }
    });
  }

  eliminarMaterial(materialId: number | string, unidad: Unidad): void {
    if (!confirm('¿Estás seguro de que deseas eliminar este material?')) return;

    this.materialesService.eliminarMaterial(materialId).subscribe({
      next: () => {
        if (unidad.contenidos) {
          unidad.contenidos = unidad.contenidos.filter((m: Material) => m.id !== materialId);
        }
        this.toastService.success('Material eliminado');
      },
      error: (err) => console.error('Error al eliminar el material', err)
    });
  }
}