import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of, switchMap, tap } from 'rxjs';

import { IMateria } from '../../../model/materia.model';
import { Destinatario, MAX_ASUNTO, MAX_CUERPO, Mensaje } from '../../../model/mensaje.model';
import { MensajesService } from '../../../services/mensajes.service';
import { ToastService } from '../../../services/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { mensajeErrorCampo } from '../../../shared/utils/form-errors';

type CampoMensaje = 'materia' | 'destinatario' | 'asunto' | 'cuerpo';

/** "Nuevo mensaje": subject -> allowed recipient (from the server) -> asunto -> cuerpo. */
@Component({
  selector: 'app-mensaje-form',
  standalone: true,
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './mensaje-form.html',
})
export class MensajeForm implements OnInit {
  private readonly mensajes = inject(MensajesService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly materias = input.required<IMateria[]>();
  readonly materiaInicial = input<number | null>(null);
  /** Reply mode: subject and recipient are fixed (the recipient must be one of the allowed ones). */
  readonly destinatarioInicial = input<number | null>(null);
  readonly asuntoInicial = input('');
  readonly enviado = output<Mensaje>();
  readonly cerrar = output<void>();

  readonly maxAsunto = MAX_ASUNTO;
  readonly maxCuerpo = MAX_CUERPO;
  readonly destinatarios = signal<Destinatario[]>([]);
  readonly cargandoDestinatarios = signal(false);
  readonly enviando = signal(false);

  readonly formulario = new FormGroup({
    materia: new FormControl<number | null>(null, Validators.required),
    destinatario: new FormControl<number | null>({ value: null, disabled: true }, Validators.required),
    asunto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_ASUNTO)],
    }),
    cuerpo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CUERPO)],
    }),
  });

  /** Sending needs a chosen recipient: not while they load and not when the subject has none. */
  readonly puedeEnviar = computed(
    () => !this.enviando() && !this.cargandoDestinatarios() && this.destinatarios().length > 0,
  );

  ngOnInit(): void {
    this.formulario.controls.materia.valueChanges
      .pipe(
        tap(() => this.reiniciarDestinatario()),
        switchMap((materiaId) => (materiaId ? this.cargarDestinatarios(materiaId) : of([] as Destinatario[]))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lista) => this.aplicarDestinatarios(lista));

    if (this.asuntoInicial()) {
      this.formulario.controls.asunto.setValue(this.asuntoInicial());
    }
    const inicial = this.materiaInicial();
    if (inicial && this.materias().some((m) => m.id === inicial)) {
      this.formulario.controls.materia.setValue(inicial);
      if (this.destinatarioInicial() !== null) {
        // Without emitEvent the lock would trigger the recipient load again.
        this.formulario.controls.materia.disable({ emitEvent: false });
      }
    }
  }

  enviar(): void {
    const { materia, destinatario, asunto, cuerpo } = this.formulario.getRawValue();
    // A disabled control is not part of `valid`, so the recipient is checked explicitly.
    if (this.formulario.invalid || !this.puedeEnviar() || materia == null || destinatario == null) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.mensajes
      .enviarMensaje({ materia_id: materia, destinatario_id: destinatario, asunto, cuerpo })
      .subscribe({
        next: (mensaje) => {
          this.enviando.set(false);
          this.toast.success('El mensaje se envió correctamente.');
          this.enviado.emit(mensaje);
        },
        error: (err: HttpErrorResponse) => {
          this.enviando.set(false);
          const texto = this.toast.readable_message_extraction(err);
          // 429: the sending limit (30/min). It is a warning, not a failure of the form.
          if (err.status === 429) {
            this.toast.warning(texto, 'Límite de envío alcanzado');
          } else {
            this.toast.error(texto, 'No se pudo enviar el mensaje');
          }
        },
      });
  }

  errorDe(campo: CampoMensaje): string | null {
    return mensajeErrorCampo(this.formulario.controls[campo]);
  }

  private cargarDestinatarios(materiaId: number) {
    this.cargandoDestinatarios.set(true);
    return this.mensajes.obtenerDestinatarios(materiaId).pipe(
      catchError((err) => {
        this.toast.error(this.toast.readable_message_extraction(err), 'No se pudieron cargar los destinatarios');
        return of([] as Destinatario[]);
      }),
    );
  }

  private reiniciarDestinatario(): void {
    this.destinatarios.set([]);
    this.formulario.controls.destinatario.reset(null);
    this.formulario.controls.destinatario.disable();
  }

  private aplicarDestinatarios(lista: Destinatario[]): void {
    const fijo = this.destinatarioInicial();
    if (fijo !== null) {
      lista = lista.filter((d) => d.id === fijo);
    }
    this.cargandoDestinatarios.set(false);
    this.destinatarios.set(lista);
    if (lista.length > 0) {
      this.formulario.controls.destinatario.enable();
    }
    if (lista.length === 1) {
      this.formulario.controls.destinatario.setValue(lista[0].id);
      if (fijo !== null) {
        this.formulario.controls.destinatario.disable({ emitEvent: false });
      }
    }
  }
}
