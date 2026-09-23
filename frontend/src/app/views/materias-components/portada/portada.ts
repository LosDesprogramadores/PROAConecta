import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  MateriaPortada,
} from '../../../model/unidad-contenido.model';
import { IMateria } from '../../../model/materia.model';
import { UnidadesMaterial } from './unidades-material/unidades-material';
import { RecursosClaseComponent } from './recursos-clase/recursos-clase';
import { MateriaService } from '../../../services/materia.service';

@Component({
  selector: 'app-portada',
  standalone: true,
  imports: [CommonModule, RouterModule, UnidadesMaterial, RecursosClaseComponent],
  templateUrl: './portada.html',
  styleUrls: ['./portada.css'],
})
export class Portada implements OnInit {
  @Input() materia?: MateriaPortada;

  cargando = signal<boolean>(false);
  error = signal<string | null>(null);
  materiaId: number | null = null;
  unidadExpandida = signal<string | null>(null);

  get datosActuales(): MateriaPortada {
    return (
      this.materia || {
        nombre: 'Cargando...',
        docente: 'Cargando profesor...',
        presentacion: 'Cargando información de la materia...',
        anio: 0,
        curso: '',
        unidades: [],
        recursosClase: [],
      }
    );
  }

  constructor(
    private readonly materiaService: MateriaService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.cargarMateriaDesdeRuta();
  }

  private cargarMateriaDesdeRuta(): void {
    this.route.parent?.paramMap.subscribe((params) => {
      const idParam = params.get('id');

      if (!idParam) {
        this.error.set('No se encontró el identificador de la materia.');
        return;
      }

      const id = Number(idParam);

      if (Number.isNaN(id)) {
        this.error.set('El identificador de la materia no es válido.');
        return;
      }

      this.materiaId = id;
      this.cargando.set(true);
      this.error.set(null);

      this.materiaService.obtenerMateriaPorId(id).subscribe({
        next: (materiaResponse) => {
          this.materia = this.convertirMateriaPortada(materiaResponse);
          this.cargando.set(false);
        },
        error: (err) => {
          console.error('Error cargando la materia:', err);
          this.error.set('No se pudo cargar la materia.');
          this.cargando.set(false);
        },
      });
    });
  }

  private convertirMateriaPortada(materia: IMateria): MateriaPortada {
    const nombreMateria = materia.titulo || 'Materia';
    const nombreProfesor = this.obtenerNombreProfesor(materia.profesor_detalle);

    return {
      nombre: nombreMateria,
      presentacion:
        materia.descripcion ||
        `Esta materia introduce los conceptos fundamentales de ${nombreMateria}.`,
      docente: nombreProfesor,
      anio: materia.anio,
      curso: materia.curso,
      unidades: [
        {
          id: 'unidad-1',
          numero: 1,
          nombre: `Introducción a ${nombreMateria}`,
          descripcion: 'Conceptos fundamentales y generalidades',
          contenidos: [],
        },
        {
          id: 'unidad-2',
          numero: 2,
          nombre: 'Desarrollo Temático',
          descripcion: 'Unidad principal de estudio',
          contenidos: [],
        },
        {
          id: 'unidad-3',
          numero: 3,
          nombre: 'Aplicaciones Prácticas',
          descripcion: 'Ejercicios y casos de estudio',
          contenidos: [],
        },
      ],
      recursosClase: [],
    };
  }

  private obtenerNombreProfesor(profesor: any): string {
    if (!profesor) {
      return 'Profesor Titular';
    }
    if (profesor.nombre && profesor.apellido) {
      return `${profesor.nombre} ${profesor.apellido}`;
    }
    return (
      profesor.nombre_completo || profesor.nombre || profesor.apellido_nombre || 'Profesor Titular'
    );
  }

  toggleUnidad(unidadId: string): void {
    if (this.unidadExpandida() === unidadId) {
      this.unidadExpandida.set(null);
    } else {
      this.unidadExpandida.set(unidadId);
    }
  }
}