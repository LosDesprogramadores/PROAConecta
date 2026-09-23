import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MateriasResumen } from './materias-resumen';

describe('MateriasResumen', () => {
  let component: MateriasResumen;
  let fixture: ComponentFixture<MateriasResumen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MateriasResumen]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MateriasResumen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
