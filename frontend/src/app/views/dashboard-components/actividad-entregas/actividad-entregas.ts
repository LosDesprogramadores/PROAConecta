import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-actividad-entregas',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './actividad-entregas.html',
})
export class ActividadEntregasComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  materiaId = signal<number | null>(null);

  ngOnInit(): void {
    this.route.parent?.paramMap.subscribe(params => {
      const matId = params.get('id');
      if (matId) {
        this.materiaId.set(Number(matId));
      }
    });
  }

  volver(): void {
    const matId = this.materiaId();
    if (matId) {
      this.router.navigate(['/view-materia', matId, 'actividades']);
    } else {
      this.router.navigate(['/dashboard/actividades']);
    }
  }
}
