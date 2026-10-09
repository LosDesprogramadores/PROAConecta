import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
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
