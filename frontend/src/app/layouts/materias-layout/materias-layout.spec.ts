import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MateriasLayout } from './materias-layout';

describe('MateriasLayout', () => {
  let component: MateriasLayout;
  let fixture: ComponentFixture<MateriasLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MateriasLayout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MateriasLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
