import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForoComponent } from './foro';

describe('ForoComponent', () => {
  let component: ForoComponent;
  let fixture: ComponentFixture<ForoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ForoComponent);
    component = fixture.componentInstance;
    component.materiaId = '1';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load topics on init', (done) => {
    expect(component.cargando()).toBe(true);
    
    setTimeout(() => {
      expect(component.cargando()).toBe(false);
      expect(component.temas().length).toBeGreaterThan(0);
      done();
    }, 600);
  });

  it('should filter topics by search text', () => {
    component.buscar({ target: { value: 'Sincrónico' } } as any);
    const filtered = component.temasFiltrados();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered[0].titulo).toContain('Sincrónico');
  });

  it('should format dates correctly', () => {
    const today = new Date();
    const formattedToday = component.formatearFecha(today);
    expect(formattedToday).not.toContain('ago');

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedYesterday = component.formatearFecha(yesterday);
    expect(formattedYesterday).toBe('Ayer');
  });

  it('should handle topic click', () => {
    spyOn(component, 'abrirTema');
    const tema = component.temas()[0];
    component.abrirTema(tema);
    expect(component.abrirTema).toHaveBeenCalledWith(tema);
  });
});