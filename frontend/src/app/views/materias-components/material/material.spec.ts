import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.model';
import { ToastService } from '../../../services/toast.service';
import { Material } from './material';

const urlMateriales = `${environment.apiUrl}materiales/`;

describe('Material', () => {
  let component: Material;
  let fixture: ComponentFixture<Material>;
  let http: HttpTestingController;
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    toast.success.mockClear();
    toast.error.mockClear();
    await TestBed.configureTestingModule({
      imports: [Material],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { pathFromRoot: [{ snapshot: { paramMap: convertToParamMap({ id: '7' }) } }] },
        },
        { provide: AuthService, useValue: { currentUser: signal({ rolId: UserRole.DOCENTE }) } },
        { provide: ToastService, useValue: toast },
      ],
    })
    .compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Material);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne((r) => r.url === urlMateriales).flush([]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts the reactive form with the defaults and resets it for a new material', () => {
    component.subirMaterial();
    expect(component.formulario.getRawValue()).toEqual({
      tipo: 'DOCUMENTO', titulo: '', descripcion: '', url: '', visible: true,
    });
  });

  it('fills the form when editing a material', () => {
    component.editarMaterial({ id: 3, materia: 7, tipo: 'VIDEO', titulo: 'Clase 1', enlace: 'https://v.test', visible: false });
    expect(component.formulario.getRawValue()).toEqual({
      tipo: 'VIDEO', titulo: 'Clase 1', descripcion: '', url: 'https://v.test', visible: false,
    });
  });

  it('refuses to save without a title', () => {
    component.subirMaterial();
    component.guardarMaterial();
    http.expectNone(urlMateriales);
    expect(toast.error).toHaveBeenCalledWith('El título es obligatorio');
  });

  it('saves the typed values, prefixing the URL with https://', () => {
    component.subirMaterial();
    component.formulario.patchValue({ titulo: '  Programa ', url: 'ejemplo.com/p', visible: false });
    component.guardarMaterial();

    const req = http.expectOne(urlMateriales);
    expect(req.request.method).toBe('POST');
    const cuerpo = req.request.body as FormData;
    expect(cuerpo.get('titulo')).toBe('Programa');
    expect(cuerpo.get('enlace')).toBe('https://ejemplo.com/p');
    expect(cuerpo.get('visible')).toBe('false');
    expect(cuerpo.get('materia')).toBe('7');
    req.flush({});
    http.expectOne((r) => r.url === urlMateriales).flush([]);
  });
});
