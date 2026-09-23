import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Welcome } from '../estudiante-inicio/welcome/welcome'; 
import { WelcomeProfesor } from '../welcome-profesor/welcome-profesor';
import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.model';

@Component({
  selector: 'app-welcome-container',
  standalone: true,
  imports: [CommonModule, Welcome, WelcomeProfesor],
  template: `
    @if (esProfesor()) {
      <app-welcome-profesor></app-welcome-profesor>
    } @else {
      <app-welcome></app-welcome>
    }
  `
})
export class WelcomeContainer {
  constructor(private readonly authService: AuthService) {}

  esProfesor = computed(() => {
    return this.authService.currentUser()?.rolId === UserRole.DOCENTE;
  });
}