import { CommonModule } from '@angular/common';
import { Component,signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Materia } from '../../../model/materia.model';

@Component({
  selector: 'app-materias',
  imports: [RouterModule, CommonModule],
  templateUrl: './materias.html',
  styleUrl: './materias.css',
})
export class Materias {
  materias = signal<Materia[]>([
    { nombre: 'Matemática', color: 'bg-red-300', path: '/dashboard/materias/matematica' },
    { nombre: 'Lengua', color: 'bg-blue-300', path: '/dashboard/materias/lengua' },
    { nombre: 'Historia', color: 'bg-green-300', path: '/dashboard/materias/historia' },
    { nombre: 'Biología', color: 'bg-yellow-300', path: '/dashboard/materias/biologia' },
    { nombre: 'Química', color: 'bg-purple-300', path: '/dashboard/materias/quimica' },
    { nombre: 'Física', color: 'bg-pink-300', path: '/dashboard/materias/fisica' },
    { nombre: 'Inglés', color: 'bg-teal-300', path: '/dashboard/materias/ingles' }
  ]);
}
