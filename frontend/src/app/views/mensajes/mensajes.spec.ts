import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';
import { Mensaje, MensajeLeido } from '../../model/mensaje.model';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { MensajesEstadoService } from '../../services/mensajes-estado.service';
import { ToastService } from '../../services/toast.service';
import { MensajesComponent } from './mensajes';

const base = `${environment.apiUrl}mensajes/`;

const mensaje = (id: string, extra: Partial<Mensaje> = {}): Mensaje => ({
  id,
  materia: { id: 7, nombre: 'Matemática I' },
  remitente: { id: 12, nombre_completo: 'Pérez, Ana' },
  destinatario: { id: 31, nombre_completo: 'Gómez, Lucía' },
  asunto: `Asunto ${id}`,
  cuerpo: `Cuerpo ${id}`,
  fecha_creacion: new Date().toISOString(),
  leido: false,
  ...extra,
});

describe('MensajesComponent', () => {
  let fixture: ComponentFixture<MensajesComponent>;
  let http: HttpTestingController;
  let nuevos$: Subject<Mensaje>;
  let leidos$: Subject<MensajeLeido>;
  let query$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let confirmacion: boolean;
  const estado = {
    noLeidos: signal(1),
    sincronizarContador: vi.fn(),
    nuevos: () => nuevos$.asObservable(),
    leidos: () => leidos$.asObservable(),
    marcarLeido: vi.fn(() => of(undefined)),
  };
  const toast = { success: vi.fn(), error: vi.fn(), readable_message_extraction: vi.fn(() => 'Error') };

  const texto = () => fixture.nativeElement.textContent as string;
  const bandeja = (results: Mensaje[], count = results.length, no_leidos = 1) =>
    http.expectOne((r) => r.url === base).flush({ count, next: null, previous: null, results, no_leidos });
  const materias = (lista: unknown[] = []) => {
    http.match((r) => r.url.includes('/materias/')).forEach((req) => req.flush(lista));
  };

  beforeEach(async () => {
    nuevos$ = new Subject<Mensaje>();
    leidos$ = new Subject<MensajeLeido>();
    query$ = new BehaviorSubject(convertToParamMap({}));
    confirmacion = true;
    estado.marcarLeido.mockClear();
    estado.sincronizarContador.mockClear();
    toast.success.mockClear();
    toast.error.mockClear();

    await TestBed.configureTestingModule({
      imports: [MensajesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: query$.asObservable() } },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ rolId: UserRole.DOCENTE, persona: { id: 5 } }) },
        },
        { provide: MensajesEstadoService, useValue: estado },
        { provide: ConfirmDialogService, useValue: { confirmar: () => of(confirmacion) } },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MensajesComponent);
    fixture.detectChanges();
  });

  it('shows loading, then the received tray from the server and syncs the unread counter', () => {
    expect(texto()).toContain('Cargando mensajes');
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('bandeja')).toBe('recibidos');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ count: 1, next: null, previous: null, results: [mensaje('1')], no_leidos: 3 });
    materias();
    fixture.detectChanges();

    expect(texto()).toContain('Asunto 1');
    expect(estado.sincronizarContador).toHaveBeenCalledWith(3);
  });

  it('shows the empty state and the error state with retry', () => {
    bandeja([]);
    materias();
    fixture.detectChanges();
    expect(texto()).toContain('No tienes mensajes recibidos.');

    fixture.componentInstance.cargar(1);
    http.expectOne((r) => r.url === base).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain('No se pudieron cargar los mensajes.');
  });

  it('switches to the sent tray', () => {
    bandeja([]);
    materias();
    fixture.componentInstance.cambiarBandeja('enviados');
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('bandeja')).toBe('enviados');
    req.flush({ count: 0, next: null, previous: null, results: [], no_leidos: 0 });
  });

  it('opens a message, shows the detail and marks it as read once', () => {
    bandeja([mensaje('1')]);
    materias();
    const c = fixture.componentInstance;

    c.seleccionar(c.mensajes()[0]);
    fixture.detectChanges();

    expect(texto()).toContain('Cuerpo 1');
    expect(estado.marcarLeido).toHaveBeenCalledTimes(1);
    expect(c.mensajes()[0].leido).toBe(true);
  });

  it('filters by the subject given in the query string', () => {
    bandeja([]);
    materias();
    query$.next(convertToParamMap({ materia: '7' }));
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('materia')).toBe('7');
    req.flush({ count: 0, next: null, previous: null, results: [], no_leidos: 0 });
  });

  it('adds a live message to the first page of the received tray, ignoring other subjects when filtered', () => {
    bandeja([mensaje('1')]);
    materias();
    nuevos$.next(mensaje('2'));
    expect(fixture.componentInstance.mensajes().map((m) => m.id)).toEqual(['2', '1']);

    query$.next(convertToParamMap({ materia: '9' }));
    bandeja([]);
    nuevos$.next(mensaje('3'));
    expect(fixture.componentInstance.mensajes().length).toBe(0);
  });

  it('shows the read receipt of a sent message', () => {
    bandeja([]);
    materias();
    fixture.componentInstance.cambiarBandeja('enviados');
    http.expectOne((r) => r.url === base).flush({ count: 1, next: null, previous: null, results: [mensaje('9')], no_leidos: 0 });

    leidos$.next({ id: '9', leido: true });
    expect(fixture.componentInstance.mensajes()[0].leido).toBe(true);
  });

  it('offers delete only for own sent messages inside the 15 minutes', () => {
    bandeja([]);
    materias();
    const c = fixture.componentInstance;
    c.cambiarBandeja('enviados');
    http.expectOne((r) => r.url === base).flush({
      count: 2, next: null, previous: null, no_leidos: 0,
      results: [mensaje('nuevo'), mensaje('viejo', { fecha_creacion: new Date(Date.now() - 16 * 60_000).toISOString() })],
    });

    c.seleccionar(c.mensajes()[0]);
    expect(c.puedeEliminar()).toBe(true);
    c.seleccionar(c.mensajes()[1]);
    expect(c.puedeEliminar()).toBe(false);
  });

  it('asks for confirmation and deletes through the API', () => {
    bandeja([]);
    materias();
    const c = fixture.componentInstance;
    c.cambiarBandeja('enviados');
    http.expectOne((r) => r.url === base).flush({ count: 1, next: null, previous: null, results: [mensaje('1')], no_leidos: 0 });
    c.seleccionar(c.mensajes()[0]);

    c.eliminarSeleccionado();
    const req = http.expectOne(`${base}1/`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(c.mensajes()).toEqual([]);
    expect(c.seleccionado()).toBeNull();
  });

  it('does not delete when the confirmation is cancelled', () => {
    bandeja([]);
    materias();
    const c = fixture.componentInstance;
    c.cambiarBandeja('enviados');
    http.expectOne((r) => r.url === base).flush({ count: 1, next: null, previous: null, results: [mensaje('1')], no_leidos: 0 });
    c.seleccionar(c.mensajes()[0]);

    confirmacion = false;
    c.eliminarSeleccionado();
    http.expectNone(`${base}1/`);
    expect(c.mensajes().length).toBe(1);
  });

  it('reports a server refusal on delete through the toast and keeps the message', () => {
    bandeja([]);
    materias();
    const c = fixture.componentInstance;
    c.cambiarBandeja('enviados');
    http.expectOne((r) => r.url === base).flush({ count: 1, next: null, previous: null, results: [mensaje('1')], no_leidos: 0 });
    c.seleccionar(c.mensajes()[0]);

    c.eliminarSeleccionado();
    http.expectOne(`${base}1/`).flush({ detail: 'El mensaje ya no puede eliminarse.' }, { status: 400, statusText: 'Bad' });
    expect(toast.error).toHaveBeenCalled();
    expect(c.mensajes().length).toBe(1);
  });

  it('opens the new message form', () => {
    bandeja([]);
    materias();
    fixture.componentInstance.formularioAbierto.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-mensaje-form')).not.toBeNull();
  });

  it('ignores a stale response when a newer request was made (tab change)', () => {
    const c = fixture.componentInstance;
    const primera = http.expectOne((r) => r.url === base);
    materias();
    c.cambiarBandeja('enviados');
    const segunda = http.expectOne((r) => r.url === base);

    expect(primera.cancelled).toBe(true);
    segunda.flush({ count: 1, next: null, previous: null, results: [mensaje('nuevo')], no_leidos: 0 });
    expect(c.mensajes().map((m) => m.id)).toEqual(['nuevo']);
  });

  it('does not count twice a live message that is already in the list', () => {
    bandeja([mensaje('1')]);
    materias();
    nuevos$.next(mensaje('2'));
    nuevos$.next(mensaje('2'));
    expect(fixture.componentInstance.total()).toBe(2);
  });

  it('re-checks the 15-minute window on click and warns when it expired', () => {
    bandeja([]);
    materias();
    const c = fixture.componentInstance;
    c.cambiarBandeja('enviados');
    http.expectOne((r) => r.url === base).flush({
      count: 1, next: null, previous: null, no_leidos: 0,
      results: [mensaje('1', { fecha_creacion: new Date(Date.now() - 16 * 60_000).toISOString() })],
    });
    c.seleccionar(c.mensajes()[0]);

    c.eliminarSeleccionado();
    http.expectNone(`${base}1/`);
    expect(toast.error).toHaveBeenCalled();
  });

  it('hides the delete button when the window ends while the message stays open', () => {
    bandeja([]);
    materias();
    const c = fixture.componentInstance;
    c.cambiarBandeja('enviados');
    http.expectOne((r) => r.url === base).flush({
      count: 1, next: null, previous: null, no_leidos: 0,
      results: [mensaje('1', { fecha_creacion: new Date(Date.now() - 14.8 * 60_000).toISOString() })],
    });
    c.seleccionar(c.mensajes()[0]);
    expect(c.puedeEliminar()).toBe(true);

    const real = Date.now;
    vi.spyOn(Date, 'now').mockImplementation(() => real() + 60_000);
    c.refrescarReloj();
    expect(c.puedeEliminar()).toBe(false);
    vi.restoreAllMocks();
  });
});
