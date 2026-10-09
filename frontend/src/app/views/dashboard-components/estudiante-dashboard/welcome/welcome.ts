import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';
import { Informacion } from '../informacion/informacion';
import { Materias } from '../../materias/materias';
import { ProximasEntregas } from '../proximas-entregas/proximas-entregas';
import { AnunciosResumen } from '../anuncios-resumen/anuncios-resumen';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, Materias, Informacion, ProximasEntregas, AnunciosResumen],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.css'],
})
export class Welcome {

  constructor(private readonly authService: AuthService) {}

  userName = computed(() => {
    const persona = this.authService.currentUser()?.persona;
    return persona ? `${persona.nombre} ${persona.apellido}` : 'Usuario';
  });

}