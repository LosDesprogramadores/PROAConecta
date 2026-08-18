import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class Footer {
  abierto = signal(false);
  anioActual = new Date().getFullYear();

  toggle(): void {
    this.abierto.update(v => !v);
  }
}
