import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecursosClaseComponent } from './recursos-clase';

describe('RecursosClaseComponent', () => {
  let component: RecursosClaseComponent;
  let fixture: ComponentFixture<RecursosClaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecursosClaseComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecursosClaseComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
