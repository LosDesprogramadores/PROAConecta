import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';
import { SidebarMaterias } from './sidebar-materias';

describe('SidebarMaterias', () => {
  let component: SidebarMaterias;
  let fixture: ComponentFixture<SidebarMaterias>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarMaterias],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SidebarMaterias);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('SidebarMaterias links', () => {
  function crear(rol: number): SidebarMaterias {
    TestBed.configureTestingModule({
      imports: [SidebarMaterias],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }), parent: null } },
        },
        { provide: AuthService, useValue: { rol: () => rol } },
      ],
    });
    const fixture = TestBed.createComponent(SidebarMaterias);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('adds the Mensajes item, filtered by the subject, for the student', () => {
    const link = crear(UserRole.ESTUDIANTE).links.find((l) => l.label === 'Mensajes');
    expect(link).toEqual({ label: 'Mensajes', path: '/dashboard/mensajes', queryParams: { materia: '7' } });
  });

  it('adds the Mensajes item for the professor', () => {
    expect(crear(UserRole.DOCENTE).links.some((l) => l.label === 'Mensajes')).toBe(true);
  });

  it('does not add it for the administrator, who has no private inbox', () => {
    expect(crear(UserRole.ADMIN).links.some((l) => l.label === 'Mensajes')).toBe(false);
  });
});
