import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, filter, map } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';
import { INotificacion } from '../../model/notificacion.model';
import { EventoSocket, NotificacionSocketService } from '../../services/notificacion-socket.service';
import { Navbar } from './navbar';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Navbar notifications (logged in)', () => {
  const urlLista = `${environment.apiUrl}notificaciones/`;
  let fixture: ComponentFixture<Navbar>;
  let http: HttpTestingController;
  let eventos$: Subject<EventoSocket>;
  const urlMensajes = `${environment.apiUrl}mensajes/`;
  const vacio = { count: 0, next: null, previous: null, results: [] };

  beforeEach(async () => {
    eventos$ = new Subject<EventoSocket>();
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            token: signal('jwt'),
            currentUser: signal({ id: 1, rolId: UserRole.ESTUDIANTE, persona: { id: 5, nombre: 'Ana', apellido: 'P' } }),
          },
        },
        {
          provide: NotificacionSocketService,
          useValue: {
            eventos: () => eventos$.asObservable(),
            escucharNotificaciones: () =>
              eventos$.pipe(
                filter((e) => e.tipo === 'anuncio.creado' || e.tipo === 'notificacion.creada'),
                map((e) => e.datos as INotificacion),
              ),
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
  });

  it('shows the real unread counter and the last notifications from the API', () => {
    const req = http.expectOne((r) => r.url === urlLista);
    expect(req.request.params.get('page_size')).toBe('5');
    req.flush({
      count: 1, next: null, previous: null, no_leidas: 3,
      results: [{ id: 'n1', titulo: 'Parcial', mensaje: 'Jueves', alcance: 'AMBOS', leida: false }],
    });
    http.expectOne((r) => r.url === urlMensajes).flush({ ...vacio, no_leidos: 0 });
    fixture.detectChanges();

    expect(fixture.componentInstance.unreadCount()).toBe(3);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Parcial');
  });

  it('raises the counter with a live notification and lowers it when marked as read', () => {
    http.expectOne((r) => r.url === urlLista).flush({ count: 0, next: null, previous: null, no_leidas: 0, results: [] });

    http.expectOne((r) => r.url === urlMensajes).flush({ ...vacio, no_leidos: 0 });
    eventos$.next({
      tipo: 'notificacion.creada',
      fecha: '',
      datos: { id: 'n2', titulo: 'Nuevo', mensaje: 'm', alcance: 'AMBOS', leida: false },
    });
    expect(fixture.componentInstance.unreadCount()).toBe(1);

    fixture.componentInstance.marcarNotificacionLeida(fixture.componentInstance.notifications()[0]);
    http.expectOne(`${urlLista}n2/leer/`).flush({ id: 'n2', leida: true });
    expect(fixture.componentInstance.unreadCount()).toBe(0);
  });

  it('shows the last real messages and the unread counter, and raises it with mensaje.nuevo', () => {
    http.expectOne((r) => r.url === urlLista).flush({ ...vacio, no_leidas: 0 });
    http.expectOne((r) => r.url === urlMensajes).flush({
      ...vacio,
      no_leidos: 2,
      results: [
        {
          id: 'm1',
          materia: { id: 7, nombre: 'Matemática I' },
          remitente: { id: 12, nombre_completo: 'Pérez, Ana' },
          destinatario: { id: 1, nombre_completo: 'Yo' },
          asunto: 'Consulta TP 2',
          cuerpo: 'c',
          fecha_creacion: '2026-10-08T14:00:00Z',
          leido: false,
        },
      ],
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Consulta TP 2');
    expect(fixture.componentInstance.unreadMessages()).toBe(2);

    eventos$.next({
      tipo: 'mensaje.nuevo',
      fecha: '',
      datos: {
        id: 'm2',
        materia: { id: 7, nombre: 'Matemática I' },
        remitente: { id: 12, nombre_completo: 'Pérez, Ana' },
        destinatario: { id: 1, nombre_completo: 'Yo' },
        asunto: 'Otro',
        cuerpo: 'c',
        fecha_creacion: '2026-10-08T14:05:00Z',
        leido: false,
      },
    });
    expect(fixture.componentInstance.unreadMessages()).toBe(3);
  });
});

describe('Navbar section links inside a materia (desktop)', () => {
  const vacio = { count: 0, next: null, previous: null, results: [] };

  async function abrirMateria(rolId: UserRole): Promise<HTMLAnchorElement[]> {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            token: signal('jwt'),
            currentUser: signal({ id: 1, rolId, persona: { id: 5, nombre: 'Ana', apellido: 'P' } }),
          },
        },
        {
          provide: NotificacionSocketService,
          useValue: { eventos: () => new Subject<EventoSocket>(), escucharNotificaciones: () => new Subject() },
        },
      ],
    }).compileComponents();
    await TestBed.inject(Router).navigateByUrl('/view-materia/7/anuncios');
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    http.match(() => true).forEach((req) => req.flush({ ...vacio, no_leidas: 0, no_leidos: 0 }));
    fixture.detectChanges();
    // The first "lg:flex" group is the desktop center nav; the mobile menu is a separate block
    const escritorio = (fixture.nativeElement as HTMLElement).querySelector('header nav div.hidden.lg\\:flex');
    return Array.from(escritorio!.querySelectorAll('a'));
  }

  const etiquetas = (links: HTMLAnchorElement[]) => links.map((a) => a.textContent!.trim());
  const rutas = (links: HTMLAnchorElement[]) => links.map((a) => a.getAttribute('href'));

  it('shows the student their section links, pointing to the student routes, without duplicates', async () => {
    const links = await abrirMateria(UserRole.ESTUDIANTE);

    expect(etiquetas(links)).toEqual(['Anuncios', 'Material', 'Actividades', 'Calificaciones', 'Mensajes']);
    expect(rutas(links).slice(0, 4)).toEqual([
      '/view-materia/7/anuncios',
      '/view-materia/7/estudiante/material',
      '/view-materia/7/estudiante/actividades',
      '/view-materia/7/estudiante/calificaciones',
    ]);
    expect(new Set(etiquetas(links)).size).toBe(links.length);
  });

  it('keeps the professor links unchanged', async () => {
    const links = await abrirMateria(UserRole.DOCENTE);

    expect(etiquetas(links)).toEqual(['Anuncios', 'Material', 'Actividades', 'Calificaciones', 'Alumnos', 'Mensajes']);
    expect(rutas(links).slice(0, 4)).toEqual([
      '/view-materia/7/anuncios',
      '/view-materia/7/material',
      '/view-materia/7/actividades',
      '/view-materia/7/calificaciones',
    ]);
  });

  it('keeps the administrator links unchanged', async () => {
    const links = await abrirMateria(UserRole.ADMIN);

    expect(etiquetas(links)).toEqual(['Anuncios', 'Material', 'Actividades', 'Calificaciones']);
    expect(rutas(links)).toEqual([
      '/view-materia/7/anuncios',
      '/view-materia/7/material',
      '/view-materia/7/actividades',
      '/view-materia/7/calificaciones',
    ]);
  });
});
