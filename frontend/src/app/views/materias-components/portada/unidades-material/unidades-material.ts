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
  private route = inject(ActivatedRoute)

  unidades = signal<Unidad[]>([]);
  esDocente = signal<boolean>(false);
  unidadExpandida = signal<string | number | null>(null);
  mostrarFormularioUnidad = signal(false);

  nuevoNombreUnidad = '';
  nuevoDescripcionUnidad = '';
  nuevoOrdenUnidad: number = 1;
  materiaId: string | number = '';
  visible = true;

  mostrarFormularioRecurso = signal<boolean>(false);
  unidadSeleccionadaId = signal<string | number | null>(null);
  nuevoTipoRecurso = 'DOCUMENTO';
  nuevoTituloRecurso = '';
  nuevoUrlRecurso = '';
  nuevoMaterialVisible = true;

  ngOnInit() {
    this.esDocente.set(this.authService.currentUser()?.rolNombre === 'Profesor');
    //this.materiaId = localStorage.getItem('materiaId') ?? '';
    this.materiaId = this.route.snapshot.paramMap.get('id') 
    ?? this.route.parent?.snapshot.paramMap.get('id') 
    ?? '';
    console.log("ID obtenido de la URL:", this.materiaId);

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

  abrirFormularioUnidad() {
    this.mostrarFormularioUnidad.set(true);
  }

  cancelarFormularioUnidad() {
    this.mostrarFormularioUnidad.set(false);
    this.nuevoNombreUnidad = '';
    this.nuevoDescripcionUnidad = '';
  }

  guardarUnidad() {
    if (!this.nuevoNombreUnidad.trim()) return;

    const payload = {
      materia: this.materiaId,
      titulo: this.nuevoNombreUnidad,
      descripcion: this.nuevoDescripcionUnidad,
      visible: this.visible
    };

    this.unidadesService.crearUnidad(payload).subscribe({
      next: () => {
        this.toastService.success('Unidad creada correctamente');
        this.cargarUnidades();
        this.cancelarFormularioUnidad();
      },
      error: () => this.toastService.error('Error al crear la unidad')
    });
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

  // LÓGICA DE RECURSOS / MATERIALES
  abrirFormularioRecurso(unidadId: string | number, event?: Event) {
    if (event) event.stopPropagation();
    this.unidadSeleccionadaId.set(unidadId);
    this.nuevoTipoRecurso = 'DOCUMENTO';
    this.nuevoTituloRecurso = '';
    this.nuevoUrlRecurso = '';
    this.mostrarFormularioRecurso.set(true);
  }

  cancelarFormularioRecurso() {
    this.mostrarFormularioRecurso.set(false);
    this.unidadSeleccionadaId.set(null);
  }

  guardarRecurso() {
    const unidadId = this.unidadSeleccionadaId();
    if (!unidadId || !this.nuevoTituloRecurso.trim() || !this.nuevoUrlRecurso.trim()) return;

    let urlFormateada = this.nuevoUrlRecurso.trim();
    if (!/^https?:\/\//i.test(urlFormateada)) {
      urlFormateada = `https://${urlFormateada}`;
    }

    const tipoFormateado = this.nuevoTipoRecurso.toUpperCase();

    const nuevoMaterial: Material = {
      unidad: unidadId,
      materia: this.materiaId,
      titulo: this.nuevoTituloRecurso,
      tipo: tipoFormateado,
      enlace: urlFormateada
    };
    console.log("Material a crear:", nuevoMaterial);

    this.materialesService.crearMaterial(nuevoMaterial).subscribe({
      next: () => {
        this.toastService.success('Material agregado');
        this.cargarMaterialesDeUnidad(unidadId);
        this.cancelarFormularioRecurso();
      },
      error: () => this.toastService.error('Error al guardar el recurso')
    });
  }

  alternarVisibilidadMaterial(material: any): void {
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

eliminarMaterial(materialId: number | string, unidad: any): void {
  if (!confirm('¿Estás seguro de que deseas eliminar este material?')) return;

  this.materialesService.eliminarMaterial(materialId).subscribe({
    next: () => {
      if (unidad.contenidos) {
        unidad.contenidos = unidad.contenidos.filter((m: any) => m.id !== materialId);
      } else if (unidad.materiales) {
        unidad.materiales = unidad.materiales.filter((m: any) => m.id !== materialId);
      }
    },
    error: (err) => console.error('Error al eliminar el material', err)
  });
}
}