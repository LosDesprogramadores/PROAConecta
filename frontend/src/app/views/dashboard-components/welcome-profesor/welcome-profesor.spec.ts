import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WelcomeProfesor } from './welcome-profesor';

describe('WelcomeProfesor', () => {
  let component: WelcomeProfesor;
  let fixture: ComponentFixture<WelcomeProfesor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WelcomeProfesor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WelcomeProfesor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
