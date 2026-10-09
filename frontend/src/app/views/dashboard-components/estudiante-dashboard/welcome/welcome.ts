import { Component, computed, inject } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { Informacion } from '../informacion/informacion';
import { Materias } from '../../materias/materias';
import { ProximasEntregas } from '../proximas-entregas/proximas-entregas';
import { AnunciosResumen } from '../anuncios-resumen/anuncios-resumen';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [Materias, Informacion, ProximasEntregas, AnunciosResumen],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.css'],
})
export class Welcome {
  private readonly authService = inject(AuthService);


  userName = computed(() => {
    const persona = this.authService.currentUser()?.persona;
    return persona ? `${persona.nombre} ${persona.apellido}` : 'Usuario';
  });

}