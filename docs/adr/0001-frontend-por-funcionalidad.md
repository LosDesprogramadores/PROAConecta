# ADR 0001: Frontend organizado por funcionalidad

- Estado: aceptado
- Fecha: 2026-10-06
- Responsable: Maxi (Frontend)
- Relacionado: spec 008 (FE-05, FE-06), tarea T065, TSK164

## Contexto

El código de `frontend/src/app/` está agrupado por tipo técnico: `views/`, `services/`, `model/`, `shared/`, `guards/`. Para tocar una sola funcionalidad (por ejemplo, el contenido de una unidad) hay que abrir cuatro carpetas distintas, y los archivos más grandes mezclan estado, lógica y presentación. En el momento de esta decisión:

| Archivo | Líneas | Problema |
|---|---|---|
| `contenido-unidad` (ts + html) | 737 | Estado, formulario, validación y lista en un solo componente |
| `actividad-estudiante` (ts + html) | 704 | Lista, consigna, entrega y formulario juntos |
| `navbar` (ts + html) | 674 | Enlaces por rol, notificaciones, mensajes y perfil juntos |

Cuatro personas cambian el frontend el mismo día, así que mover todo de una vez genera conflictos seguros.

## Decisión

1. **Estructura por funcionalidad.** El código nuevo y el que se toque se agrupa en `frontend/src/app/features/<funcionalidad>/`. Cada funcionalidad contiene sus componentes, su servicio, su modelo y sus specs:

   ```
   features/
     aula-virtual/
       contenido-unidad/
         contenido-unidad.ts          contenedor
         contenido-item/              presentacional: un contenido
         contenido-form/              presentacional: alta y edición
         contenido-tipo.ts            funciones puras de etiquetas y ayudas
   ```

2. **Contenedor y presentacional.**
   - El *contenedor* tiene el estado y habla con servicios y con el padre. Decide qué hacer con lo que emiten los hijos.
   - El *presentacional* recibe datos con `input()`, emite eventos con `output()` y no inyecta servicios de datos. Se prueba solo, sin HTTP.
   - Lo que es lógica sin estado (etiquetas, formatos, textos de ayuda) va en funciones puras con su spec.

3. **Tamaño.** Ningún componente supera 250 líneas (ts o html por separado). Si lo supera, se divide por responsabilidad.

4. **Dependencias.** Una funcionalidad puede usar `shared/`, `core/` y `model/` globales. Una funcionalidad no importa otra funcionalidad; si dos necesitan lo mismo, eso sube a `shared/`.

5. **`shared/`, `core/` y `guards/` se quedan donde están.** Son transversales (modal, paginador, toast, interceptores, autenticación). Solo las vistas y los servicios propios de una funcionalidad se mudan a `features/`.

6. **Aplicación gradual.** No hay una migración masiva. Se aplica cuando se toca la funcionalidad por otro motivo, siempre con specs de caracterización antes de mover código y sin cambiar el comportamiento.

## Primer paso (esta decisión)

`contenido-unidad` se dividió en `features/aula-virtual/contenido-unidad/` con un contenedor y dos presentacionales (`contenido-item`, `contenido-form`) más las funciones de `contenido-tipo.ts`. Antes de mover el código se escribió un spec de caracterización que maneja solo el DOM, y sigue en verde después de la división.

## Siguientes pasos

Orden sugerido, de menor a mayor riesgo. Cada uno es un commit propio y empieza con specs de caracterización:

1. `actividad-estudiante` (lista de actividades, consigna, entrega) a `features/aula-virtual/actividad-estudiante/`.
2. `navbar` en tres partes: enlaces de navegación, campana de notificaciones y bandeja de mensajes (ya tienen su estado en `NotificacionesEstadoService` y `MensajesEstadoService`, lo que facilita el corte).
3. El resto de `views/materias-components/` (portada, material, unidades, recursos) a `features/aula-virtual/`.
4. `views/admin/*`, `tabla-generica` y los servicios de administración a `features/administracion/`.
5. `mensajes`, `notificaciones` y sus servicios a `features/comunicacion/`.
6. Retirar las carpetas vacías de `views/` y `services/` cuando no quede nada.

## Consecuencias

- Positivas: los cambios de una funcionalidad quedan en una carpeta; los presentacionales se prueban sin HTTP; los archivos de más de 250 líneas dejan de aparecer.
- Negativas: durante la migración conviven dos estructuras (`views/` y `features/`), y las rutas importan de ambas. Es un costo temporal aceptado.
- Alternativa descartada: mover todo de una vez. Es un cambio de tamaño L que choca con las ramas en curso y mezcla refactor con cambios de comportamiento, lo que vuelve inviable la revisión.
