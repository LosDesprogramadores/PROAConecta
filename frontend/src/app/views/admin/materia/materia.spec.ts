import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Materia } from './materia';

describe('Materia', () => {
  let component: Materia;
  let fixture: ComponentFixture<Materia>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Materia]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Materia);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
