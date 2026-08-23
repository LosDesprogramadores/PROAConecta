import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

export interface MateriaPortada {
  nombre: string;
  docente: string;
  presentacion: string;
  cronograma: string[];
}

@Component({
  selector: 'app-portada',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './portada.html',
  styleUrl: './portada.css',
})
export class Portada {
  @Input() materia?: MateriaPortada;

  // Hardcode de prueba
  materiaDemo: MateriaPortada = {
    nombre: 'Matemática I',
    docente: 'Prof. Carlos Scarpatti',
    presentacion: 'Esta materia introduce los conceptos básicos de álgebra y geometría, con aplicaciones prácticas.',
    cronograma: [
      'Unidad 1: Números reales y operaciones',
      'Unidad 2: Álgebra básica',
      'Unidad 3: Funciones y gráficas',
      'Unidad 4: Geometría analítica',
      'Unidad 5: Exámenes parciales y finales'
    ]
  };

  // Rol docente/admin para probar controles de edición
  esDocente = signal<boolean>(true);

  // Estados para la edición de la presentación
  editandoDescripcion = signal<boolean>(false);
  tempDescripcion = '';

  iniciarEdicionDescripcion() {
    const data = this.materia || this.materiaDemo;
    this.tempDescripcion = data.presentacion;
    this.editandoDescripcion.set(true);
  }

  guardarDescripcion() {
    const data = this.materia || this.materiaDemo;
    data.presentacion = this.tempDescripcion;
    this.editandoDescripcion.set(false);
  }

  cancelarEdicionDescripcion() {
    this.editandoDescripcion.set(false);
  }

  // Acciones de gestión docente
  abrirModalActividad() {
    console.log('Abrir modal para crear actividad');
  }

  abrirModalRecurso() {
    console.log('Abrir modal para subir recurso');
  }
}