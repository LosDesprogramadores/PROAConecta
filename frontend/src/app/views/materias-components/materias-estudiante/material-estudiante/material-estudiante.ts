import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../../../services/toast.service';
import { MaterialesService } from '../../../../services/materiales.service';
import { UnidadesService } from '../../../../services/unidades.service';
import { Material, Unidad } from '../../../../model/unidad-material.model';

import { Modal } from '../../../../shared/modal/modal';
import { ArchivoProtegidoDirective } from '../../../../core/http/archivo-protegido.directive';
@Component({
  selector: 'app-material-estudiante',
  standalone: true,
  imports: [Modal, CommonModule, ArchivoProtegidoDirective],
  templateUrl: './material-estudiante.html',
  styleUrl: './material-estudiante.css',
})
export class MaterialEstudiante implements OnInit {
  private materialesService = inject(MaterialesService);
  private unidadesService = inject(UnidadesService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);

  // Estado general
  materiaId = signal<number | null>(null);
  cargando = signal(false);

  // Materiales Generales
  recursos = signal<Material[]>([]);

  // Unidades Temáticas y sus contenidos
  unidades = signal<Unidad[]>([]);
  unidadExpandida = signal<string | number | null>(null);
  cargandoMaterialesUnidad = signal<Set<string | number>>(new Set());

  // Control de tarjetas/descripciones desplegadas
  tarjetasExpandidas = signal<Set<number | string>>(new Set());

  // Control de Modal de vista previa / detalles
  recursoSeleccionadoModal = signal<Material | null>(null);

  ngOnInit(): void {
    const idEncontrado =
      this.obtenerParametroDeRuta('id') || this.obtenerParametroDeRuta('materiaId');

    if (idEncontrado) {
      const idNum = Number(idEncontrado);
      this.materiaId.set(idNum);
      this.cargarDatos(idNum);
    } else {
      console.error('❌ [MaterialEstudiante] No se pudo encontrar ningún ID en la URL.');
    }
  }

  private obtenerParametroDeRuta(paramName: string): string | null {
    let currentRoute: ActivatedRoute | null = this.route;

    while (currentRoute) {
      const val = currentRoute.snapshot.params[paramName];
      if (val) return val;
      currentRoute = currentRoute.parent;
    }

    return this.route.snapshot.queryParams[paramName] || null;
  }

  cargarDatos(materiaId: number): void {
    this.cargando.set(true);

    // Cargar Recursos Generales
    this.materialesService.obtenerMaterialesGenerales(materiaId).subscribe({
      next: (data) => {
        const visibles = data.filter((m) => m.visible !== false);
        this.recursos.set(visibles);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar recursos generales:', err);
        this.toastService.error('Error al cargar los recursos de la materia');
        this.cargando.set(false);
      },
    });

    // Cargar Unidades
    this.unidadesService.obtenerUnidadesPorMateria(materiaId).subscribe({
      next: (data) => {
        // Filtrar unidades que están visibles para estudiantes
        const unidadesVisibles = data.filter((u) => u.visible !== false);
        this.unidades.set(unidadesVisibles);
      },
      error: (err) => {
        console.error('Error al cargar las unidades:', err);
        this.toastService.error('Error al cargar las unidades del programa');
      },
    });
  }

  // --- LÓGICA DE DESPLIEGUE DE UNIDADES ---

  toggleUnidad(unidadId: string | number | undefined): void {
    if (!unidadId) return;

    if (this.unidadExpandida() === unidadId) {
      this.unidadExpandida.set(null);
      return;
    }

    this.unidadExpandida.set(unidadId);

    // Cargar contenidos solo si no se han obtenido previamente
    const unidadActual = this.unidades().find((u) => u.id === unidadId);
    if (!unidadActual?.contenidos) {
      this.cargarMaterialesDeUnidad(unidadId);
    }
  }

  cargarMaterialesDeUnidad(unidadId: string | number): void {
    // Indicar carga local
    this.cargandoMaterialesUnidad.update((set) => new Set(set).add(unidadId));

    this.materialesService.obtenerMaterialesPorUnidad(unidadId).subscribe({
      next: (materiales) => {
        const visibles = materiales.filter((m) => m.visible !== false);

        this.unidades.update((lista) =>
          lista.map((u) => (u.id === unidadId ? { ...u, contenidos: visibles } : u)),
        );

        this.cargandoMaterialesUnidad.update((set) => {
          const nuevo = new Set(set);
          nuevo.delete(unidadId);
          return nuevo;
        });
      },
      error: (err) => {
        console.error('Error al cargar materiales de unidad:', err);
        this.toastService.error('Error al cargar los contenidos de la unidad');

        this.cargandoMaterialesUnidad.update((set) => {
          const nuevo = new Set(set);
          nuevo.delete(unidadId);
          return nuevo;
        });
      },
    });
  }

  // --- AUXILIARES Y MODALES ---

  toggleExpandir(id: number | string | undefined): void {
    if (!id) return;
    this.tarjetasExpandidas.update((set) => {
      const nuevoSet = new Set(set);
      if (nuevoSet.has(id)) {
        nuevoSet.delete(id);
      } else {
        nuevoSet.add(id);
      }
      return nuevoSet;
    });
  }

  estaExpandido(id: number | string | undefined): boolean {
    return id ? this.tarjetasExpandidas().has(id) : false;
  }

  abrirModal(recurso: Material): void {
    this.recursoSeleccionadoModal.set(recurso);
  }

  cerrarModal(): void {
    this.recursoSeleccionadoModal.set(null);
  }

  iconoTipo(tipo?: string): string {
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

  tipoLabel(tipo?: string): string {
    switch (tipo) {
      case 'VIDEO':
        return 'Video';
      case 'DOCUMENTO':
        return 'Documento';
      case 'ENLACE':
        return 'Enlace Web';
      default:
        return 'Recurso';
    }
  }

  obtenerUrl(material: Material): string {
    return material.enlace || this.obtenerArchivoUrl(material.archivo);
  }

  private obtenerArchivoUrl(archivo: File | string | null | undefined): string {
    if (!archivo) return '#';
    if (typeof archivo === 'string') return archivo;
    return URL.createObjectURL(archivo);
  }
}
