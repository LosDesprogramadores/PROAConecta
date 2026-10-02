import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialEstudiante } from './material-estudiante';

describe('MaterialEstudiante', () => {
  let component: MaterialEstudiante;
  let fixture: ComponentFixture<MaterialEstudiante>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialEstudiante]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaterialEstudiante);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
