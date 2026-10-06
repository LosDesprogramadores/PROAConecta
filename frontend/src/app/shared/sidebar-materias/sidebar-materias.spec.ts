import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SidebarMaterias } from './sidebar-materias';

describe('SidebarMaterias', () => {
  let component: SidebarMaterias;
  let fixture: ComponentFixture<SidebarMaterias>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarMaterias],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SidebarMaterias);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
