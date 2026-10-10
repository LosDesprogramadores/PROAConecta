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
    expect((fixture.nativeElement as HTMLElement).querySelector('#notifications-button')!.getAttribute('aria-label'))
      .toBe('Notificaciones, 3 sin leer');
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

const vacioPaginado = { count: 0, next: null, previous: null, results: [] };

async function montarNavbar(rolId: UserRole | null, url: string): Promise<ComponentFixture<Navbar>> {
  await TestBed.configureTestingModule({
    imports: [Navbar],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: AuthService,
        useValue: {
          token: signal(rolId ? 'jwt' : null),
          currentUser: signal(rolId ? { id: 1, rolId, persona: { id: 5, nombre: 'Ana', apellido: 'P' } } : null),
        },
      },
      {
        provide: NotificacionSocketService,
        useValue: { eventos: () => new Subject<EventoSocket>(), escucharNotificaciones: () => new Subject() },
      },
    ],
  }).compileComponents();
  await TestBed.inject(Router).navigateByUrl(url);
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(Navbar);
  fixture.detectChanges();
  http.match(() => true).forEach((req) => req.flush({ ...vacioPaginado, no_leidas: 0, no_leidos: 0 }));
  fixture.detectChanges();
  return fixture;
}

const enlaces = (fixture: ComponentFixture<Navbar>, testid: string): HTMLAnchorElement[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(`[data-testid="${testid}"] a`));
const etiquetas = (links: HTMLAnchorElement[]) => links.map((a) => a.textContent!.trim());
const rutas = (links: HTMLAnchorElement[]) => links.map((a) => a.getAttribute('href'));

describe('Navbar section links inside a materia (desktop)', () => {
  it('shows the student Portada first and then their sections, without Material, without duplicates', async () => {
    const links = enlaces(await montarNavbar(UserRole.ESTUDIANTE, '/view-materia/7/anuncios'), 'nav-secciones-escritorio');

    expect(etiquetas(links)).toEqual(['Portada', 'Anuncios', 'Actividades', 'Calificaciones', 'Mensajes']);
    expect(rutas(links).slice(0, 4)).toEqual([
      '/view-materia/7/estudiante/portada',
      '/view-materia/7/anuncios',
      '/view-materia/7/estudiante/actividades',
      '/view-materia/7/estudiante/calificaciones',
    ]);
    expect(rutas(links)[4]).toBe('/dashboard/mensajes?materia=7');
  });

  it('shows the professor Portada first and keeps the rest of the links', async () => {
    const links = enlaces(await montarNavbar(UserRole.DOCENTE, '/view-materia/7/anuncios'), 'nav-secciones-escritorio');

    expect(etiquetas(links)).toEqual(['Portada', 'Anuncios', 'Material', 'Actividades', 'Calificaciones', 'Alumnos', 'Mensajes']);
    expect(rutas(links).slice(0, 5)).toEqual([
      '/view-materia/7/portada-profesor',
      '/view-materia/7/anuncios',
      '/view-materia/7/material',
      '/view-materia/7/actividades',
      '/view-materia/7/calificaciones',
    ]);
  });

  it('shows the administrator Portada first (the shared materia cover) and keeps the rest', async () => {
    const links = enlaces(await montarNavbar(UserRole.ADMIN, '/view-materia/7/anuncios'), 'nav-secciones-escritorio');

    expect(etiquetas(links)).toEqual(['Portada', 'Anuncios', 'Material', 'Actividades', 'Calificaciones']);
    expect(rutas(links)[0]).toBe('/view-materia/7/portada');
  });

  it('highlights Portada only on the cover page (exact match)', async () => {
    const enPortada = enlaces(await montarNavbar(UserRole.ESTUDIANTE, '/view-materia/7/estudiante/portada'), 'nav-secciones-escritorio');
    expect(enPortada[0].classList.contains('text-sky-700')).toBe(true);
    expect(enPortada[1].classList.contains('text-sky-700')).toBe(false);
  });

  it('does not highlight Portada on another section', async () => {
    const enAnuncios = enlaces(await montarNavbar(UserRole.ESTUDIANTE, '/view-materia/7/anuncios'), 'nav-secciones-escritorio');
    expect(enAnuncios[0].classList.contains('text-sky-700')).toBe(false);
    expect(enAnuncios[1].classList.contains('text-sky-700')).toBe(true);
  });
});

describe('Navbar section links inside a materia (mobile menu)', () => {
  it('shows the student the same sections as on desktop, Portada first and without Material', async () => {
    const links = enlaces(await montarNavbar(UserRole.ESTUDIANTE, '/view-materia/7/anuncios'), 'nav-secciones-movil');

    expect(etiquetas(links)).toEqual(['Portada', 'Anuncios', 'Actividades', 'Calificaciones', 'Mensajes']);
    expect(rutas(links)[0]).toBe('/view-materia/7/estudiante/portada');
  });

  it('shows the professor the materia sections on mobile', async () => {
    const links = enlaces(await montarNavbar(UserRole.DOCENTE, '/view-materia/7/actividades'), 'nav-secciones-movil');

    expect(etiquetas(links)[0]).toBe('Portada');
    expect(rutas(links)[0]).toBe('/view-materia/7/portada-profesor');
    expect(etiquetas(links)).toContain('Material');
    expect(etiquetas(links)).toContain('Mensajes');
  });
});

describe('Navbar materia context in Mensajes', () => {
  it('keeps the materia sections for the professor at /dashboard/mensajes?materia=4', async () => {
    const links = enlaces(await montarNavbar(UserRole.DOCENTE, '/dashboard/mensajes?materia=4'), 'nav-secciones-escritorio');

    expect(rutas(links)).toContain('/view-materia/4/actividades');
    expect(rutas(links)).toContain('/dashboard/mensajes?materia=4');
  });

  it('keeps the materia sections for the student at /dashboard/mensajes?materia=4', async () => {
    const links = enlaces(await montarNavbar(UserRole.ESTUDIANTE, '/dashboard/mensajes?materia=4'), 'nav-secciones-escritorio');

    expect(etiquetas(links)).toEqual(['Portada', 'Anuncios', 'Actividades', 'Calificaciones', 'Mensajes']);
    expect(rutas(links)[1]).toBe('/view-materia/4/anuncios');
  });

  it('shows no materia sections at /dashboard/mensajes without the materia param', async () => {
    const links = enlaces(await montarNavbar(UserRole.DOCENTE, '/dashboard/mensajes'), 'nav-secciones-escritorio');

    expect(links).toEqual([]);
  });

  it('follows the URL when it changes after the component was created', async () => {
    const fixture = await montarNavbar(UserRole.DOCENTE, '/dashboard/welcome');
    expect(enlaces(fixture, 'nav-secciones-escritorio')).toEqual([]);

    await TestBed.inject(Router).navigateByUrl('/dashboard/mensajes?materia=9');
    fixture.detectChanges();
    expect(rutas(enlaces(fixture, 'nav-secciones-escritorio'))).toContain('/view-materia/9/anuncios');

    await TestBed.inject(Router).navigateByUrl('/view-materia/3/anuncios');
    fixture.detectChanges();
    expect(rutas(enlaces(fixture, 'nav-secciones-escritorio'))).toContain('/view-materia/3/anuncios');

    await TestBed.inject(Router).navigateByUrl('/dashboard/welcome');
    fixture.detectChanges();
    expect(enlaces(fixture, 'nav-secciones-escritorio')).toEqual([]);
  });
});

describe('Navbar logo', () => {
  const logo = (fixture: ComponentFixture<Navbar>) =>
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('[data-testid="logo-inicio"]');

  it.each([
    [UserRole.DOCENTE, '/dashboard/welcome'],
    [UserRole.ESTUDIANTE, '/dashboard/estudiante/welcome'],
    [UserRole.ADMIN, '/dashboard-admin'],
  ])('sends role %s to its home', async (rol, destino) => {
    const fixture = await montarNavbar(rol, '/view-materia/7/anuncios');

    expect(Array.from(logo(fixture)).map((a) => a.getAttribute('href'))).toEqual([destino]);
  });

  it('sends a visitor without session to the public home', async () => {
    const fixture = await montarNavbar(null, '/home');

    expect(Array.from(logo(fixture)).map((a) => a.getAttribute('href'))).toEqual(['/']);
  });
});

describe('Navbar notifications link', () => {
  it.each([UserRole.DOCENTE, UserRole.ESTUDIANTE])('points "Ver todas las notificaciones" to /dashboard/anuncios (role %s)', async (rol) => {
    const fixture = await montarNavbar(rol, '/dashboard/welcome');
    const link = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).find((a) =>
      a.textContent!.includes('Ver todas las notificaciones'),
    );

    expect(link!.getAttribute('href')).toBe('/dashboard/anuncios');
  });
});
