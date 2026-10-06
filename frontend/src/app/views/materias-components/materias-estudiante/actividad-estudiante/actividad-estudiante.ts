import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ActividadesService, Entrega } from '../../../../services/actividades.service';
import { Actividad } from '../../../../model/actividad-model';
import { ToastService } from '../../../../services/toast.service';
import { Toast } from '../../../../shared/toast/toast'; 

import { Modal } from '../../../../shared/modal/modal';
import { ArchivoProtegidoDirective } from '../../../../core/http/archivo-protegido.directive';
export type FiltroEstudiante = 'TODAS' | 'PENDIENTES' | 'ENTREGADAS';

@Component({
  selector: 'app-actividad-estudiante',
  standalone: true,
  imports: [Modal, CommonModule, RouterModule, ReactiveFormsModule, Toast, ArchivoProtegidoDirective],
  templateUrl: './actividad-estudiante.html',
  styleUrl: './actividad-estudiante.css',
})
export class ActividadEstudiante implements OnInit {
  private authService = inject(AuthService);
  private actividadesService = inject(ActividadesService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private fb = inject(NonNullableFormBuilder);

  currentUser = this.authService.currentUser;

  // Estado general
  materiaId = signal<number | null>(null);
  materiaTitulo = signal<string>('');
  actividades = signal<Actividad[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

  // Filtros
  filtro = signal<FiltroEstudiante>('TODAS');

  // Modal Consigna / Detalle
  actividadSeleccionada = signal<Actividad | null>(null);
  modalConsignaAbierto = signal<boolean>(false);

  // Modal Entrega del Estudiante
  modalEntregaAbierto = signal<boolean>(false);
  miEntregaActual = signal<Entrega | null>(null);
  cargandoMiEntrega = signal<boolean>(false);

  // Formulario de Entrega
  readonly formEntrega = this.fb.group({
    contenidoTexto: '',
    enlaceUrl: '',
  });
  archivoSeleccionado: File | null = null;
  eliminarArchivoPrevio = signal<boolean>(false);
  enviandoEntrega = signal<boolean>(false);
  errorFormulario = signal<string | null>(null);
  modoEdicion = signal<boolean>(false);

  // Map local para saber rápido si una actividad ya tiene entrega
  entregasMap = signal<Record<number, Entrega>>({});

  ngOnInit(): void {

    const idEncontrado =
      this.obtenerParametroDeRuta('id') || this.obtenerParametroDeRuta('materiaId');
    if (idEncontrado) {
      const idNum = Number(idEncontrado);
      this.materiaId.set(idNum);
      this.cargarTodasLasActividades();
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

  private cargarTodasLasActividades(): void {
  this.cargando.set(true);
  this.error.set(null);

  this.actividadesService.getActividades().subscribe({
    next: (data: Actividad[]) => {
      const idActual = this.materiaId();

      const actividadesFiltradas = idActual !== null
        ? data.filter(actividad => Number(actividad.materia) === idActual)
        : data;

      this.actividades.set(actividadesFiltradas);

      this.cargando.set(false);
      this.precargarEstadoEntregas();
    },
    error: (err: any) => {
      console.error('Error al cargar actividades:', err);
      this.error.set('No se pudieron cargar las actividades.');
      this.cargando.set(false);
    }
  });
}

  private precargarEstadoEntregas(): void {
    this.actividadesService.getMisEntregas().subscribe({
      next: (misEntregas: Entrega[]) => {
        const mapa: Record<number, Entrega> = {};

        if (Array.isArray(misEntregas)) {
          misEntregas.forEach(entrega => {
            const actId = typeof entrega.actividad === 'object'
              ? (entrega.actividad as any).id
              : entrega.actividad;

            if (actId) {
              mapa[actId] = entrega;
            }
          });
        }

        this.entregasMap.set(mapa);
      },
      error: (err) => {
        console.error('Error al obtener mis entregas:', err);
      }
    });
  }

  // --- FILTROS COMPUTADOS ---
  actividadesFiltradas = computed(() => {
    const lista = this.actividades();
    const mapa = this.entregasMap();

    switch (this.filtro()) {
      case 'PENDIENTES':
        return lista.filter(a => !mapa[a.id]);
      case 'ENTREGADAS':
        return lista.filter(a => !!mapa[a.id]);
      case 'TODAS':
      default:
        return lista;
    }
  });

  // --- MODAL DETALLE / CONSIGNA ---
  verConsigna(actividad: Actividad): void {
    this.actividadSeleccionada.set(actividad);
    this.modalConsignaAbierto.set(true);
  }

  cerrarModalConsigna(): void {
    this.modalConsignaAbierto.set(false);
    this.actividadSeleccionada.set(null);
  }

  // --- MODAL REALIZAR / EDITAR ENTREGA ---
  abrirModalEntrega(actividad: Actividad): void {
    this.actividadSeleccionada.set(actividad);
    this.modalEntregaAbierto.set(true);
    this.limpiarFormulario();

    const miEntrega = this.entregasMap()[actividad.id] || null;

    if (miEntrega) {
      this.miEntregaActual.set(miEntrega);
      this.formEntrega.setValue({
        contenidoTexto: miEntrega.contenido_texto || '',
        enlaceUrl: miEntrega.enlace || '',
      });
      this.modoEdicion.set(false);
    } else {
      this.miEntregaActual.set(null);
      this.modoEdicion.set(true);
    }
  }

  cerrarModalEntrega(): void {
    this.modalEntregaAbierto.set(false);
    this.actividadSeleccionada.set(null);
    this.miEntregaActual.set(null);
    this.limpiarFormulario();
  }

  limpiarFormulario(): void {
    this.formEntrega.reset();
    this.archivoSeleccionado = null;
    this.eliminarArchivoPrevio.set(false);
    this.errorFormulario.set(null);
    this.modoEdicion.set(false);
  }

  habilitarEdicion(): void {
    this.modoEdicion.set(true);
  }

  onArchivoSeleccionado(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.archivoSeleccionado = file;
    }
  }

  // Método para quitar el archivo actualmente guardado
quitarArchivoPrevio(): void {
  this.eliminarArchivoPrevio.set(true);
}

// Método para restaurar el archivo si cambió de opinión
restaurarArchivoPrevio(): void {
  this.eliminarArchivoPrevio.set(false);
}

guardarEntrega(): void {
  const act = this.actividadSeleccionada();
  if (!act) return;

  const { contenidoTexto, enlaceUrl } = this.formEntrega.getRawValue();
  const tieneTexto = !!contenidoTexto.trim();
  const tieneEnlace = !!enlaceUrl.trim();
  const tieneNuevoArchivo = !!this.archivoSeleccionado;
  const conservaArchivoPrevio = !!this.miEntregaActual()?.archivo && !this.eliminarArchivoPrevio();

  if (!tieneTexto && !tieneEnlace && !tieneNuevoArchivo && !conservaArchivoPrevio) {
    const msg = 'Por favor incluye al menos un archivo, enlace o respuesta en texto.';
    this.errorFormulario.set(msg);
    this.toastService.warning('Datos incompletos', msg);
    return;
  }

  this.enviandoEntrega.set(true);
  this.errorFormulario.set(null);

  const formData = new FormData();
  formData.append('actividad', String(act.id));

  if (tieneTexto) {
    formData.append('contenido_texto', contenidoTexto.trim());
  } else {
    formData.append('contenido_texto', '');
  }

  if (tieneEnlace) {
    formData.append('enlace', enlaceUrl.trim());
  } else {
    formData.append('enlace', '');
  }

  // MANEJO DE ARCHIVOS
  if (tieneNuevoArchivo) {
    formData.append('archivo', this.archivoSeleccionado!);
  } else if (this.eliminarArchivoPrevio()) {
    formData.append('archivo', '');
    formData.append('eliminar_archivo', 'true');
  }

  const entregaExistente = this.miEntregaActual();

  const operacion$ = entregaExistente
    ? this.actividadesService.actualizarEntrega(entregaExistente.id, formData)
    : this.actividadesService.crearEntrega(formData);

  operacion$.subscribe({
    next: (entregaGuardada: Entrega) => {
      this.miEntregaActual.set(entregaGuardada);
      this.entregasMap.update(m => ({ ...m, [act.id]: entregaGuardada }));
      this.enviandoEntrega.set(false);
      this.modoEdicion.set(false);
      this.eliminarArchivoPrevio.set(false);
      this.archivoSeleccionado = null;

      const mensajeExito = entregaExistente ? 'Entrega actualizada correctamente.' : 'Entrega enviada con éxito.';
      this.toastService.success('¡Operación exitosa!', mensajeExito);
    },
    error: (err: any) => {
      console.error('Detalle del error del Backend:', err.error);
      this.enviandoEntrega.set(false);

      const msjError = this.toastService.readable_message_extraction(err);

      this.errorFormulario.set(msjError);
      this.toastService.error('Error al enviar', msjError);
    }
  });
}

  // Auxiliares de estado y fechas
  estaVencida(actividad: Actividad): boolean {
    if (!actividad.fecha_limite) return false;
    return new Date(actividad.fecha_limite) < new Date();
  }

  puedeEntregarOEditar(actividad: Actividad): boolean {
    const entrega = this.entregasMap()[actividad.id] || this.miEntregaActual();

    if (entrega?.nota) {
      return false;
    }

    return !this.estaVencida(actividad) || actividad.permitir_entrega_tardia;
  }

  formatearFecha(fechaStr?: string): string {
    if (!fechaStr) return 'Sin fecha';
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) {
      return fechaStr.replace('T', ' ').slice(0, 16);
    }
    return fecha.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
}