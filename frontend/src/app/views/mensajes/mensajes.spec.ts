import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MensajesComponent } from './mensajes';

describe('MensajesComponent', () => {
  let component: MensajesComponent;
  let fixture: ComponentFixture<MensajesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MensajesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MensajesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
