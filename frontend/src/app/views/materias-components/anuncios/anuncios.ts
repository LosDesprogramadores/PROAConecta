import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.model';
import { AnuncioMateria } from '../../../model/anuncio-materia.model';
import { AnunciosService } from '../../../services/anuncios.service';
import { MateriaService } from '../../../services/materia.service';
import { NotificacionSocketService } from '../../../services/notificacion-socket.service';
import { ToastService } from '../../../services/toast.service';
import { Paginador } from '../../../shared/paginador/paginador';
import { mensajeErrorCampo } from '../../../shared/utils/form-errors';

const TAMANO_PAGINA = 10;
export const MAX_TITULO = 120;
export const MAX_MENSAJE = 2000;

@Component({
  selector: 'app-anuncios-materia',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Paginador],
  templateUrl: './anuncios.html',
  styleUrls: ['./anuncios.css']
})
export class AnunciosMateriaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly anunciosService = inject(AnunciosService);
  private readonly materiaService = inject(MateriaService);
  private readonly socket = inject(NotificacionSocketService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly tamanoPagina = TAMANO_PAGINA;
  readonly maxTitulo = MAX_TITULO;
  readonly maxMensaje = MAX_MENSAJE;

  materiaId = '';

  readonly anuncios = signal<AnuncioMateria[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly filtroTexto = signal('');
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly enviando = signal(false);
  readonly esTitular = signal(false);

  readonly anunciosFiltrados = computed(() => {
    const filtro = this.filtroTexto().toLowerCase();
    return filtro
      ? this.anuncios().filter((a) => a.titulo.toLowerCase().includes(filtro))
      : this.anuncios();
  });

  readonly formulario = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(MAX_TITULO)]],
    mensaje: ['', [Validators.required, Validators.maxLength(MAX_MENSAJE)]],
  });

  ngOnInit(): void {
    this.materiaId = this.route.snapshot.paramMap.get('id') ?? this.route.parent?.snapshot.paramMap.get('id') ?? '';
    if (!this.materiaId) {
      this.error.set(true);
      this.cargando.set(false);
      return;
    }
    this.verificarTitular();
    this.cargarAnuncios(1);
    this.escucharAnunciosNuevos();
  }

  cargarAnuncios(pagina: number): void {
    this.cargando.set(true);
    this.error.set(false);
    this.anunciosService.listarPorMateria(this.materiaId, { page: pagina, page_size: TAMANO_PAGINA }).subscribe({
      next: (respuesta) => {
        this.anuncios.set(respuesta.results);
        this.total.set(respuesta.count);
        this.pagina.set(pagina);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  publicar(): void {
    if (this.formulario.invalid || this.enviando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.anunciosService.publicar(this.materiaId, this.formulario.getRawValue()).subscribe({
      next: (anuncio) => {
        this.agregarSiNoExiste(anuncio);
        this.formulario.reset();
        this.enviando.set(false);
        this.toast.success('El anuncio se publicó correctamente.');
      },
      error: (err) => {
        this.enviando.set(false);
        this.toast.error(this.toast.readable_message_extraction(err), 'No se pudo publicar el anuncio');
      },
    });
  }

  buscar(input: string | Event): void {
    const texto = typeof input === 'string' ? input : (input.target as HTMLInputElement).value;
    this.filtroTexto.set(texto);
  }

  errorDe(campo: 'titulo' | 'mensaje'): string | null {
    return mensajeErrorCampo(this.formulario.controls[campo]);
  }

  trackByAnuncioId(_index: number, anuncio: AnuncioMateria): string {
    return anuncio.id;
  }

  /** The titular professor is the only one who writes: the subject says who that is. */
  private verificarTitular(): void {
    const usuario = this.auth.currentUser();
    if (usuario?.rolId !== UserRole.DOCENTE) {
      return;
    }
    this.materiaService.obtenerMateriaPorId(Number(this.materiaId)).subscribe({
      next: (materia) => this.esTitular.set(materia.profesor != null && materia.profesor === usuario.persona?.id),
      error: () => this.esTitular.set(false),
    });
  }

  private escucharAnunciosNuevos(): void {
    this.socket
      .eventos()
      .pipe(
        filter((e) => e.tipo === 'anuncio.creado'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((evento) => {
        const anuncio = evento.datos as AnuncioMateria;
        if (String(anuncio.materia_id) === this.materiaId) {
          this.agregarSiNoExiste(anuncio);
        }
      });
  }

  /** The publisher receives its own event too, so the id decides. Only the first page shows it live. */
  private agregarSiNoExiste(anuncio: AnuncioMateria): void {
    if (this.anuncios().some((a) => a.id === anuncio.id)) {
      return;
    }
    this.total.update((n) => n + 1);
    if (this.pagina() === 1) {
      this.anuncios.update((lista) => [anuncio, ...lista].slice(0, TAMANO_PAGINA));
    }
  }
}
