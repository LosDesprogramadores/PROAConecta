import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Subject } from 'rxjs';

import { DashboardLayout } from './dashboard-layout';

describe('DashboardLayout', () => {
  let component: DashboardLayout;
  let fixture: ComponentFixture<DashboardLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardLayout],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('unsubscribes from router events when destroyed', () => {
    // Router.events is a Subject; its observer count must drop when the layout goes away.
    const subject = TestBed.inject(Router).events as unknown as Subject<unknown>;
    const antes = subject.observers.length;

    fixture.destroy();

    expect(subject.observers.length).toBe(antes - 1);
  });
});
