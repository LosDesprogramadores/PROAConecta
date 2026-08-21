import { Component, Input } from '@angular/core';

interface MateriaPortada {
  nombre: string;
  docente: string;
  presentacion: string;
  cronograma: string[];
}

@Component({
  selector: 'app-portada',
  imports: [],
  templateUrl: './portada.html',
  styleUrl: './portada.css',
})
export class Portada {
@Input() materia!: MateriaPortada;

  // Hardcode de prueba
  materiaDemo: MateriaPortada = {
    nombre: 'Matemática I',
    docente: 'Prof. Juan Pérez',
    presentacion: 'Esta materia introduce los conceptos básicos de álgebra y geometría, con aplicaciones prácticas.',
    cronograma: [
      'Unidad 1: Números reales y operaciones',
      'Unidad 2: Álgebra básica',
      'Unidad 3: Funciones y gráficas',
      'Unidad 4: Geometría analítica',
      'Unidad 5: Exámenes parciales y finales'
    ]
  };
}
