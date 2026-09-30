import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActividadesService } from '../../../services/actividades.service';
import { MateriaService } from '../../../services/materia.service';
import { AuthService } from '../../../core/auth/auth.service';
import { IMateria } from '../../../model/materia.model';

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
  private materiaService = inject(MateriaService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  form!: FormGroup;
  isEdicion = signal(false);
  actividadId = signal<number | null>(null);
  materiaIdParam = signal<number | null>(null);
  cargando = signal(false);
  error = signal<string | null>(null);

  // materias asignadas al profesor (solo se usan cuando se entra desde el dashboard general)
  materiasProfesor = signal<IMateria[]>([]);
  cargandoMaterias = signal(false);

  // el selector solo aparece al crear desde el dashboard general
  mostrarSelectorMateria = computed(
    () => !this.isEdicion() && this.materiaIdParam() === null
  );

  ngOnInit(): void {
    this.initForm();

    // 1) Materia por contexto: query param (?materiaId=5) o ruta /view-materia/5/...
    const desdeQuery = this.route.snapshot.queryParamMap.get('materiaId');
    const desdeUrl = this.router.url.match(/view-materia\/(\d+)/)?.[1];
    const desdeParent = this.route.parent?.snapshot.paramMap.get('id');
    const matId = Number(desdeQuery ?? desdeUrl ?? desdeParent);

    if (!Number.isNaN(matId) && matId > 0) {
      this.materiaIdParam.set(matId);
      this.form.patchValue({ materia: matId });
    }

    // 2) Modo edición (la ruta tiene el id de la actividad)
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id && !this.materiaIdParam()) {
        // ruta del dashboard general con id de actividad
        this.activarEdicion(Number(id));
      } else if (id && this.router.url.includes('/editar')) {
        this.activarEdicion(Number(id));
      }
    });

    // 3) Sin contexto de materia: cargar el desplegable del profesor
    if (this.mostrarSelectorMateria()) {
      this.cargarMateriasDelProfesor();
    }
  }

  private activarEdicion(id: number): void {
    this.isEdicion.set(true);
    this.actividadId.set(id);
    this.cargarDatosActividad(id);
  }

  private initForm(): void {
    this.form = this.fb.group({
      titulo: ['', [Validators.required, Validators.maxLength(200)]],
      descripcion: [''],
      materia: [null, [Validators.required]],
      fecha_limite: ['', [Validators.required]],
      estado: ['PUBLICADA', [Validators.required]],
      permitir_entrega_tardia: [false],
      enlace: [''],
    });
  }

  private cargarMateriasDelProfesor(): void {
    const profesorId = this.authService.currentUser()?.id;
    if (!profesorId) {
      this.error.set('No se pudo identificar al profesor.');
      return;
    }

    this.cargandoMaterias.set(true);
    this.materiaService.obtenerMateriasPorProfesor(Number(profesorId)).subscribe({
      next: materias => {
        this.materiasProfesor.set(materias);
        this.cargandoMaterias.set(false);
      },
      error: err => {
        console.error('Error cargando materias del profesor:', err);
        this.error.set('No se pudieron cargar tus materias.');
        this.cargandoMaterias.set(false);
      },
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
    const datos = { ...this.form.value, materia: Number(this.form.value.materia) };

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
    // desde una materia -> vuelve a esa materia; desde el dashboard -> vuelve al dashboard
    const matId =
      this.materiaIdParam() ??
      (this.isEdicion() ? this.form.get('materia')?.value : null);

    if (matId) {
      this.router.navigate(['/view-materia', matId, 'actividades']);
    } else {
      this.router.navigate(['/dashboard/actividades']);
    }
  }
}