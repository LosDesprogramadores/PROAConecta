import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Navbar } from '../../shared/navbar/navbar';
import { Footer } from '../../shared/footer/footer';

@Component({
  selector: 'app-materias-layout',
  imports: [
    RouterOutlet,
    Navbar,
    Footer,
  ],
  templateUrl: './materias-layout.html',
  styleUrl: './materias-layout.css',
})
export class MateriasLayout {}