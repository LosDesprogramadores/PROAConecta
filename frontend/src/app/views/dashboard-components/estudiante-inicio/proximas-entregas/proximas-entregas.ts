import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarModule, CalendarView, CalendarEvent } from 'angular-calendar';
import { isSameDay } from 'date-fns';
import { ActividadesService } from '../../../../services/actividades.service';
import { Actividad } from '../../../../model/actividad-model';

@Component({
  selector: 'app-proximas-entregas',
  standalone: true,
  imports: [CommonModule, CalendarModule],
  templateUrl: './proximas-entregas.html',
  styleUrl: './proximas-entregas.css',
})
export class ProximasEntregas implements OnInit {
  private actividadesService = inject(ActividadesService);

  isSameDay = isSameDay;
  view: CalendarView = CalendarView.Month;
  viewDate: Date = new Date();
  
  // Día seleccionado (por defecto hoy)
  selectedDate = signal<Date>(new Date());

  actividades = signal<Actividad[]>([]);

  events = computed<CalendarEvent[]>(() => {
    return this.actividades()
      .filter(actividad => !!actividad.fecha_limite)
      .map(actividad => {
        const fechaLimiteIso = actividad.fecha_limite.replace(' ', 'T');
        const fecha = new Date(fechaLimiteIso);

        return {
          start: fecha,
          title: `${actividad.materia_titulo}: ${actividad.titulo}`,
          color: { primary: '#f59e0b', secondary: '#fef3c7' },
          meta: actividad
        };
      });
  });

  // Entregas correspondientes al día seleccionado
  selectedDayEvents = computed(() => {
    return this.events().filter(event => isSameDay(event.start, this.selectedDate()));
  });

  ngOnInit(): void {
    this.obtenerEntregas();
  }

  obtenerEntregas(): void {
    this.actividadesService.getActividades().subscribe({
      next: (data) => this.actividades.set(data),
      error: (err) => console.error('Error al cargar actividades para el calendario:', err)
    });
  }

  dayClicked(day: { date: Date; events: CalendarEvent[]; inMonth: boolean }): void {
    if (day.inMonth) {
      this.selectedDate.set(day.date);
    }
  }
}