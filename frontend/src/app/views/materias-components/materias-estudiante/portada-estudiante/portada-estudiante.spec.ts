import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortadaEstudiante } from './portada-estudiante';

describe('PortadaEstudiante', () => {
  let component: PortadaEstudiante;
  let fixture: ComponentFixture<PortadaEstudiante>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortadaEstudiante]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PortadaEstudiante);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
