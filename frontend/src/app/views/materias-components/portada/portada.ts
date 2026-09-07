import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  UnidadMateria,
  ContenidoUnidad,
  MateriaPortada
} from '../../../model/unidad-contenido.model';

import { ContenidoUnidadComponent } from './contenido-unidad/contenido-unidad';


@Component({
  selector: 'app-portada',

  standalone: true,

  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ContenidoUnidadComponent
  ],

  templateUrl: './portada.html',

  styleUrl: './portada.css',
})
export class Portada {

  @Input() materia?: MateriaPortada;


  // ==========================================
  // DATOS DEMO
  // ==========================================

  materiaDemo: MateriaPortada = {

    nombre: 'Matemática I',

    docente: 'Prof. Carlos Scarpatti',

    presentacion:
      'Esta materia introduce los conceptos básicos de álgebra y geometría, con aplicaciones prácticas en la vida cotidiana y profesional.',

    unidades: [

      {
        id: 'unidad-1',

        numero: 1,

        nombre: 'Números reales y operaciones',

        descripcion:
          'Fundamentos de números reales y operaciones básicas',

        contenidos: [

          {
            id: 'contenido-1',

            titulo: 'Guía de Números Reales',

            descripcion:
              'Documento completo sobre números reales',

            tipo: 'documento',

            url:
              'https://drive.google.com/file/d/EJEMPLO/view',

            fechaCreacion:
              new Date('2026-09-01'),

            visible: true,
          },

          {
            id: 'contenido-2',

            titulo: 'Tutorial en Video',

            descripcion:
              'Explicación de operaciones',

            tipo: 'video',

            url:
              'https://www.youtube.com/watch?v=dQw4w9WgXcQ',

            fechaCreacion:
              new Date('2026-09-02'),

            visible: true,
          }

        ]
      },


      {
        id: 'unidad-2',

        numero: 2,

        nombre: 'Álgebra básica',

        descripcion:
          'Conceptos fundamentales de álgebra',

        contenidos: []

      },


      {
        id: 'unidad-3',

        numero: 3,

        nombre: 'Funciones y gráficas',

        descripcion:
          'Estudio de funciones y representación gráfica',

        contenidos: []

      },


      {
        id: 'unidad-4',

        numero: 4,

        nombre: 'Geometría analítica',

        descripcion:
          'Geometría en el plano cartesiano',

        contenidos: []

      }

    ]

  };


  // ==========================================
  // ROL
  // ==========================================

  esDocente = signal<boolean>(true);


  // ==========================================
  // EDICIÓN DE PRESENTACIÓN
  // ==========================================

  editandoDescripcion =
    signal<boolean>(false);

  tempDescripcion = '';


  // ==========================================
  // UNIDAD ABIERTA
  // ==========================================

  unidadExpandida =
    signal<string | null>(null);


  // ==========================================
  // DATOS ACTUALES
  // ==========================================

  get datosActuales(): MateriaPortada {

    return this.materia || this.materiaDemo;

  }


  // ==========================================
  // PRESENTACIÓN
  // ==========================================

  iniciarEdicionDescripcion() {

    this.tempDescripcion =
      this.datosActuales.presentacion;

    this.editandoDescripcion.set(true);

  }


  guardarDescripcion() {

    this.datosActuales.presentacion =
      this.tempDescripcion;

    this.editandoDescripcion.set(false);

    console.log('Descripción guardada');

  }


  cancelarEdicionDescripcion() {

    this.editandoDescripcion.set(false);

  }


  // ==========================================
  // UNIDADES
  // ==========================================

  toggleUnidad(unidadId: string) {

    if (this.unidadExpandida() === unidadId) {

      this.unidadExpandida.set(null);

    } else {

      this.unidadExpandida.set(unidadId);

    }

  }


  trackByUnidad(
    index: number,
    unidad: UnidadMateria
  ): string {

    return unidad.id;

  }


  // ==========================================
  // CONTENIDOS
  // ==========================================

  onContenidoGuardado(
    unidadId: string,
    contenido: ContenidoUnidad
  ) {

    const unidad =
      this.datosActuales.unidades.find(
        u => u.id === unidadId
      );

    if (!unidad) {

      return;

    }


    const indiceExistente =
      unidad.contenidos.findIndex(
        c => c.id === contenido.id
      );


    // Actualizar
    if (indiceExistente >= 0) {

      const fechaOriginal =
        unidad.contenidos[indiceExistente]
          .fechaCreacion;

      unidad.contenidos[indiceExistente] = {

        ...contenido,

        fechaCreacion: fechaOriginal

      };

      console.log(
        'Contenido actualizado:',
        contenido
      );

    }

    // Nuevo
    else {

      unidad.contenidos.push({
        ...contenido
      });

      console.log(
        'Contenido agregado:',
        contenido
      );

    }

  }


  onContenidoEliminado(
    unidadId: string,
    contenidoId: string
  ) {

    const unidad =
      this.datosActuales.unidades.find(
        u => u.id === unidadId
      );

    if (!unidad) {

      return;

    }


    const indice =
      unidad.contenidos.findIndex(
        c => c.id === contenidoId
      );


    if (indice >= 0) {

      unidad.contenidos.splice(
        indice,
        1
      );

      console.log(
        'Contenido eliminado:',
        contenidoId
      );

    }

  }


  // ==========================================
  // MÉTODOS LEGACY
  // ==========================================

  abrirModalActividad() {

    console.log(
      'Abrir modal para crear actividad'
    );

  }


  abrirModalRecurso() {

    console.log(
      'Abrir modal para subir recurso'
    );

  }

}