import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ContenidoUnidadComponent } from '../contenido-unidad/contenido-unidad';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { UnidadesService } from '../../../../services/unidades.service';
import { Unidad } from '../../../../model/unidad-material.model';

@Component({
  selector: 'app-unidades-material',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule, ContenidoUnidadComponent],
  templateUrl: './unidades-material.html',
  styleUrl: './unidades-material.css',
})
export class UnidadesMaterial implements OnInit {
  private unidadesService = inject(UnidadesService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  unidades = signal<Unidad[]>([]);
  esDocente = signal<boolean>(false);
  unidadExpandida = signal<string | number | null>(null);
  mostrarFormularioUnidad = signal(false);

  nuevoNombreUnidad = '';
  nuevoDescripcionUnidad = '';
  materiaId: string | number = '';

  ngOnInit() {
    //this.esDocente.set(this.authService.esDocente?.() ?? true);
    this.esDocente.set(true);

    this.materiaId = localStorage.getItem('materiaId') || '5';

    if (this.materiaId) {
      this.cargarUnidades();
    }
  }

  cargarUnidades() {
    this.unidadesService.obtenerUnidadesPorMateria(this.materiaId).subscribe({
      next: (data) => {
      console.log('✅ Datos recibidos de Django REST:', data);
      this.unidades.set(data);
      console.log('📊 Signal unidades actualizada. Longitud:', this.unidades().length);
    },
      error: () => this.toastService.error('Error al cargar las unidades')
    });
  }

  toggleUnidad(id: string | number) {
    this.unidadExpandida.update(v => v === id ? null : id);
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
      visible: true
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

  onContenidoGuardado(unidadId: string | number, event: any) {
    this.cargarUnidades();
  }

  onContenidoEliminado(unidadId: string | number, event: any) {
    this.cargarUnidades();
  }
}