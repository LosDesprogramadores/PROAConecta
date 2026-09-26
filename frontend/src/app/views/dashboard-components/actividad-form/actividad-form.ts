import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActividadesService } from '../../../services/actividades.service';

@Component({
  selector: 'app-actividad-form',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './actividad-form.html',
  styleUrl: './actividad-form.css',
})
export class ActividadForm implements OnInit {
  private fb = inject(FormBuilder);
  private actividadesService = inject(ActividadesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  form!: FormGroup;
  isEdicion = signal(false);
  actividadId = signal<number | null>(null);
  materiaIdParam = signal<number | null>(null);
  cargando = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.initForm();

    // Capturar si viene un materiaId por queryParams de forma correcta
    this.route.queryParamMap.subscribe(params => {
      const matId = params.get('materiaId');
      if (matId) {
        this.materiaIdParam.set(Number(matId));
        this.form.patchValue({ materia: Number(matId) });
      }
    });

    // Capturar si estamos en modo edición (si la ruta tiene un ID)
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.isEdicion.set(true);
        this.actividadId.set(Number(id));
        this.cargarDatosActividad(Number(id));
      }
    });
  }

  private initForm(): void {
    this.form = this.fb.group({
      titulo: ['', [Validators.required, Validators.maxLength(200)]],
      descripcion: [''],
      materia: ['', [Validators.required]],
      fecha_limite: ['', [Validators.required]],
      estado: ['PUBLICADA', [Validators.required]],
      permitir_entrega_tardia: [false],
      enlace: [''],
    });
  }

  private cargarDatosActividad(id: number): void {
    this.cargando.set(true);
    this.actividadesService.getActividadById(id).subscribe({
      next: (actividad) => {
        this.form.patchValue({
          titulo: actividad.titulo,
          descripcion: actividad.descripcion,
          materia: typeof actividad.materia === 'object' ? (actividad.materia as any).id : actividad.materia,
          fecha_limite: actividad.fecha_limite ? actividad.fecha_limite.substring(0, 16) : '',
          estado: actividad.estado,
          permitir_entrega_tardia: actividad.permitir_entrega_tardia,
          enlace: actividad.enlace,
        });
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error cargando actividad:', err);
        this.error.set('No se pudo cargar la información de la actividad.');
        this.cargando.set(false);
      }
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    const datos = this.form.value;

    if (this.isEdicion() && this.actividadId()) {
      this.actividadesService.updateActividad(this.actividadId()!, datos).subscribe({
        next: () => {
          this.cargando.set(false);
          this.volver();
        },
        error: (err) => {
          console.error('Error actualizando actividad:', err);
          this.error.set('Error al actualizar la actividad.');
          this.cargando.set(false);
        }
      });
    } else {
      this.actividadesService.crearActividad(datos).subscribe({
        next: () => {
          this.cargando.set(false);
          this.volver();
        },
        error: (err) => {
          console.error('Error creando actividad:', err);
          this.error.set('Error al crear la actividad.');
          this.cargando.set(false);
        }
      });
    }
  }

  volver(): void {
    const matId = this.materiaIdParam() || this.form.get('materia')?.value;
    if (matId) {
      this.router.navigate(['/view-materia', matId, 'actividades']);
    } else {
      this.router.navigate(['/dashboard/actividades']);
    }
  }
}
