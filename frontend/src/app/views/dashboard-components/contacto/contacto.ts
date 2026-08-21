import { Component } from '@angular/core';

@Component({
  selector: 'app-contacto',
  imports: [],
  templateUrl: './contacto.html',
  styleUrl: './contacto.css',
})
export class Contacto {
  secretaria = {
    nombre: 'Secretaría Académica',
    horarios: 'Lunes a Viernes de 8:00 a 16:00',
    telefono: '+54 388 1234567',
    email: 'secretaria@escuela.edu.ar',
    direccion: 'Av. Principal 123, San Salvador de Jujuy'
  };
}
