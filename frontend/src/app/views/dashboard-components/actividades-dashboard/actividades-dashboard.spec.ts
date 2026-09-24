import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActividadesDashboard } from './actividades-dashboard';

describe('ActividadesDashboard', () => {
  let component: ActividadesDashboard;
  let fixture: ComponentFixture<ActividadesDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActividadesDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActividadesDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
