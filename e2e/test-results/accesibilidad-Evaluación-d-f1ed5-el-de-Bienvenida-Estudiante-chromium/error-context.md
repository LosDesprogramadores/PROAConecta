# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accesibilidad.spec.ts >> Evaluación de Accesibilidad WCAG 2.2 Nivel AA (ACC) >> Pantallas con sesión de Estudiante >> ACC-03: Panel de Bienvenida Estudiante
- Location: tests/accesibilidad.spec.ts:92:9

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 93

- Array []
+ Array [
+   Object {
+     "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
+     "help": "Elements must meet minimum color contrast ratio thresholds",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.14/color-contrast?application=playwright",
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffa2a2",
+               "contrastRatio": 3.95,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#45556c",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.95 (foreground color: #45556c, background color: #ffa2a2, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<a class=\"rounded-xl p-5 text-center transition hover:shadow-md cursor-pointer border border-slate-100 flex flex-col items-center justify-center group bg-red-300\" href=\"/view-materia/2\">",
+                 "target": Array [
+                   ".bg-red-300",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.95 (foreground color: #45556c, background color: #ffa2a2, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-xs text-slate-600 mt-1 font-medium\"> 1ro A · 2026 </p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".bg-red-300 > .mt-1.text-slate-600.font-medium",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#8ec5ff",
+               "contrastRatio": 4.18,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#45556c",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.18 (foreground color: #45556c, background color: #8ec5ff, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<a class=\"rounded-xl p-5 text-center transition hover:shadow-md cursor-pointer border border-slate-100 flex flex-col items-center justify-center group bg-blue-300\" href=\"/view-materia/1\">",
+                 "target": Array [
+                   ".bg-blue-300",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.18 (foreground color: #45556c, background color: #8ec5ff, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-xs text-slate-600 mt-1 font-medium\"> 1ro A · 2026 </p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".bg-blue-300 > .mt-1.text-slate-600.font-medium",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2aa",
+       "wcag143",
+       "TTv5",
+       "TT13.c",
+       "EN-301-549",
+       "EN-9.1.4.3",
+       "ACT",
+       "RGAAv4",
+       "RGAA-3.2.1",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - banner [ref=e6]:
      - navigation [ref=e7]:
        - generic [ref=e8]:
          - link "P PROAConecta" [ref=e10] [cursor=pointer]:
            - /url: /dashboard/estudiante/welcome
            - generic [ref=e11]: P
            - generic [ref=e12]: PROAConecta
          - generic [ref=e13]:
            - generic [ref=e14]:
              - generic [ref=e15]:
                - button "Mensajes" [ref=e16]
                - generic:
                  - generic: Mensajes
                  - generic:
                    - link "Profesor, Pablo Hilo inline E2E 1792394932974-809 19/10/26, 4:28 a. m.":
                      - /url: /dashboard/mensajes
                      - generic [aria-hidden]: P
                      - generic:
                        - paragraph: Profesor, Pablo
                        - paragraph: Hilo inline E2E 1792394932974-809
                        - text: 19/10/26, 4:28 a. m.
                    - link "Profesor, Pablo Hilo E2E 1792394930423-5559 19/10/26, 4:28 a. m.":
                      - /url: /dashboard/mensajes
                      - generic [aria-hidden]: P
                      - generic:
                        - paragraph: Profesor, Pablo
                        - paragraph: Hilo E2E 1792394930423-5559
                        - text: 19/10/26, 4:28 a. m.
                    - link "Profesor, Pablo Consulta E2E 1792394930817 19/10/26, 4:28 a. m.":
                      - /url: /dashboard/mensajes
                      - generic [aria-hidden]: P
                      - generic:
                        - paragraph: Profesor, Pablo
                        - paragraph: Consulta E2E 1792394930817
                        - text: 19/10/26, 4:28 a. m.
                  - generic:
                    - link "Ver todos los mensajes":
                      - /url: /dashboard/mensajes
              - generic [ref=e19]:
                - button "Notificaciones, 3 sin leer" [ref=e20]:
                  - generic [ref=e23]: "3"
                - generic:
                  - generic:
                    - generic: Notificaciones
                    - generic: 3 sin leer
                  - generic:
                    - generic:
                      - generic:
                        - paragraph: Aviso control E2E 1792394929105-494
                        - paragraph: Aviso creado por la prueba end-to-end.
                        - generic:
                          - generic: 19/10/26, 7:28 a. m.
                          - button "Marcar como leída"
                    - generic:
                      - generic:
                        - paragraph: Aviso vigente E2E 1792394927754-8847
                        - paragraph: Aviso creado por la prueba end-to-end.
                        - generic:
                          - generic: 19/10/26, 7:28 a. m.
                          - button "Marcar como leída"
                    - generic:
                      - generic:
                        - paragraph: Aviso E2E 1792394927387
                        - paragraph: Mensaje de prueba end-to-end.
                        - generic:
                          - generic: 19/10/26, 7:28 a. m.
                          - button "Marcar como leída"
                  - generic:
                    - link "Ver todas las notificaciones":
                      - /url: /dashboard/anuncios
            - generic [ref=e24]: Emma Estudiante
            - generic [ref=e25]:
              - button [ref=e26]:
                - img "Foto de perfil" [ref=e27]
              - generic:
                - button "Mi Perfil"
                - separator
                - button "Cerrar sesión"
    - main [ref=e29]:
      - generic [ref=e32]:
        - generic [ref=e35]:
          - generic [ref=e36]:
            - heading "Mis Materias" [level=2] [ref=e37]
            - generic [ref=e38]:
              - generic [ref=e39]: "Mostrar:"
              - combobox "Mostrar:" [ref=e40]:
                - option "Este año (2026)" [selected]
                - option "Todas las materias"
          - generic [ref=e41]:
            - link "L Lengua y Literatura 1ro A · 2026" [ref=e42] [cursor=pointer]:
              - /url: /view-materia/2
              - generic [ref=e43]: L
              - heading "Lengua y Literatura" [level=3] [ref=e44]
              - paragraph [ref=e45]: 1ro A · 2026
            - link "M Matemática 1ro A · 2026" [ref=e46] [cursor=pointer]:
              - /url: /view-materia/1
              - generic [ref=e47]: M
              - heading "Matemática" [level=3] [ref=e48]
              - paragraph [ref=e49]: 1ro A · 2026
        - generic [ref=e50]:
          - generic [ref=e54]:
            - generic [ref=e55]:
              - generic [ref=e56]: 📝
              - generic [ref=e57]:
                - text: Actividades
                - paragraph [ref=e58]: 2 Pendientes
            - generic [ref=e59]: Ver desglose ↗
            - button "Ver actividades pendientes" [ref=e60] [cursor=pointer]
          - generic [ref=e64]:
            - generic [ref=e65]:
              - heading "Última novedad" [level=3] [ref=e66]
              - link "Ver todas" [ref=e67] [cursor=pointer]:
                - /url: /dashboard/anuncios
                - text: Ver todas
                - generic [aria-hidden] [ref=e68]: →
            - article [ref=e69] [cursor=pointer]:
              - generic [ref=e73]:
                - generic [ref=e75]:
                  - generic [ref=e76]: GENERAL
                  - generic [ref=e78]: 19/10/2026
                - heading "Aviso control E2E 1792394929105-494" [level=4] [ref=e84]
                - paragraph [ref=e85]: Aviso creado por la prueba end-to-end.
              - 'button "Ver novedad: Aviso control E2E 1792394929105-494" [ref=e86]'
          - generic [ref=e90]:
            - heading "Próximas entregas" [level=3] [ref=e91]
            - generic [ref=e92]:
              - generic [ref=e93]:
                - generic [ref=e94]: octubre 2026
                - generic [ref=e95]:
                  - button "<" [ref=e96]
                  - button ">" [ref=e97]
              - grid [ref=e100]:
                - generic [ref=e102]:
                  - generic [ref=e103]: dom
                  - generic [ref=e104]: lun
                  - generic [ref=e105]: mar
                  - generic [ref=e106]: mié
                  - generic [ref=e107]: jue
                  - generic [ref=e108]: vie
                  - generic [ref=e109]: sáb
                - generic [ref=e110]:
                  - row [ref=e112]:
                    - gridcell [ref=e113]
                    - gridcell [ref=e114]
                    - gridcell [ref=e115]
                    - gridcell [ref=e116]
                    - gridcell "1" [ref=e117]
                    - gridcell "2" [ref=e120]
                    - gridcell "3" [ref=e123]
                  - row [ref=e127]:
                    - gridcell "4" [ref=e128]
                    - gridcell "5" [ref=e131]
                    - gridcell "6" [ref=e134]
                    - gridcell "7" [ref=e137]
                    - gridcell "8" [ref=e140]
                    - gridcell "9" [ref=e143]
                    - gridcell "10" [ref=e146]
                  - row [ref=e150]:
                    - gridcell "11" [ref=e151]
                    - gridcell "12" [ref=e154]
                    - gridcell "13" [ref=e157]
                    - gridcell "14" [ref=e160]
                    - gridcell "15" [ref=e163]
                    - gridcell "16" [ref=e166]
                    - gridcell "17" [ref=e169]
                  - row [ref=e173]:
                    - gridcell "18" [ref=e174]
                    - gridcell "19" [ref=e177]
                    - gridcell "20" [ref=e180]
                    - gridcell "21" [ref=e183]
                    - gridcell "22" [ref=e186]
                    - gridcell "23" [ref=e189]
                    - gridcell "24" [ref=e192]
                  - row [ref=e196]:
                    - gridcell "25" [ref=e197]
                    - gridcell "26" [ref=e200] [cursor=pointer]
                    - gridcell "27" [ref=e205]
                    - gridcell "28" [ref=e208]
                    - gridcell "29" [ref=e211]
                    - gridcell "30" [ref=e214]
                    - gridcell "31" [ref=e217]
              - generic [ref=e220]:
                - generic [ref=e221]:
                  - generic [ref=e222]: 19 de octubre
                  - generic [ref=e223]: 0 entregas
                - paragraph [ref=e224]: Sin entregas para este día.
    - button "Información del sitio" [ref=e226]:
      - generic [ref=e227]: "?"
  - generic:
    - complementary
```

# Test source

```ts
  1   | import { test, expect, type Page } from '../fixtures';
  2   | import { ESTADO_SESION } from '../fixtures';
  3   | import AxeBuilder from '@axe-core/playwright';
  4   | import * as fs from 'fs';
  5   | import * as path from 'path';
  6   | 
  7   | /**
  8   |  * Función auxiliar para ejecutar axe-core bajo WCAG 2.2 AA,
  9   |  * exportar el reporte JSON como evidencia y filtrar violaciones graves.
  10  |  */
  11  | async function auditarPantallaWCAG(page: Page, nombrePantalla: string) {
  12  |   const resultados = await new AxeBuilder({ page })
  13  |     .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  14  |     .analyze();
  15  | 
  16  |   // Filtrar violaciones de impacto 'critical' o 'serious' según requerimiento de cátedra
  17  |   const violacionesGraves = resultados.violations.filter(
  18  |     (v) => v.impact === 'critical' || v.impact === 'serious'
  19  |   );
  20  | 
  21  |   // Generar carpeta de reportes localmente como evidencia del Entregable 5
  22  |   const dirReportes = path.join(process.cwd(), 'reportes-axe');
  23  |   if (!fs.existsSync(dirReportes)) {
  24  |     fs.mkdirSync(dirReportes, { recursive: true });
  25  |   }
  26  |   
  27  |   fs.writeFileSync(
  28  |     path.join(dirReportes, `axe-${nombrePantalla}.json`),
  29  |     JSON.stringify(
  30  |       {
  31  |         pantalla: nombrePantalla,
  32  |         url: page.url(),
  33  |         timestamp: new Date().toISOString(),
  34  |         totalViolaciones: resultados.violations.length,
  35  |         violacionesCriticasOSerias: violacionesGraves.length,
  36  |         detalleViolaciones: resultados.violations.map((v) => ({
  37  |           id: v.id,
  38  |           impact: v.impact,
  39  |           description: v.description,
  40  |           help: v.help,
  41  |           helpUrl: v.helpUrl,
  42  |           tags: v.tags.filter((t) => t.startsWith('wcag')),
  43  |           nodosAfectados: v.nodes.map((n) => ({
  44  |             html: n.html,
  45  |             target: n.target,
  46  |             failureSummary: n.failureSummary,
  47  |           })),
  48  |         })),
  49  |       },
  50  |       null,
  51  |       2
  52  |     )
  53  |   );
  54  | 
  55  |   if (violacionesGraves.length > 0) {
  56  |     console.log(`\n[ACC] Violaciones graves detectadas en [${nombrePantalla}]:`, 
  57  |       violacionesGraves.map(v => `${v.id} (${v.impact})`).join(', ')
  58  |     );
  59  |   }
  60  | 
  61  |   return violacionesGraves;
  62  | }
  63  | 
  64  | test.describe('Evaluación de Accesibilidad WCAG 2.2 Nivel AA (ACC)', () => {
  65  | 
  66  |   test.describe('Pantallas con sesión de Administrador', () => {
  67  |     test.use({ storageState: ESTADO_SESION('admin') });
  68  | 
  69  |     test('ACC-01: Dashboard Admin / Gestión de Materias', async ({ page }) => {
  70  |       await page.goto('/dashboard-admin');
  71  |       await page.getByRole('link', { name: 'Materias', exact: true }).click();
  72  |       await expect(page.getByRole('heading', { name: 'Gestión de Materias' })).toBeVisible();
  73  | 
  74  |       const violaciones = await auditarPantallaWCAG(page, 'admin-materias-listado');
  75  |       expect(violaciones, `Violaciones critical/serious en Materias: ${JSON.stringify(violaciones.map(v => v.id))}`).toEqual([]);
  76  |     });
  77  | 
  78  |     test('ACC-02: Modal de Nueva Materia (Formulario)', async ({ page }) => {
  79  |       await page.goto('/dashboard-admin');
  80  |       await page.getByRole('link', { name: 'Materias', exact: true }).click();
  81  |       await page.getByRole('button', { name: 'Nueva Materia' }).click();
  82  |       await expect(page.getByLabel('Título de la materia *')).toBeVisible();
  83  | 
  84  |       const violaciones = await auditarPantallaWCAG(page, 'admin-materia-modal-alta');
  85  |       expect(violaciones).toEqual([]);
  86  |     });
  87  |   });
  88  | 
  89  |   test.describe('Pantallas con sesión de Estudiante', () => {
  90  |     test.use({ storageState: ESTADO_SESION('estudiante') });
  91  | 
  92  |     test('ACC-03: Panel de Bienvenida Estudiante', async ({ page }) => {
  93  |       await page.goto('/dashboard/estudiante/welcome');
  94  |       await expect(page.getByRole('heading', { name: 'Mis Materias' })).toBeVisible();
  95  | 
  96  |       const violaciones = await auditarPantallaWCAG(page, 'estudiante-welcome');
> 97  |       expect(violaciones).toEqual([]);
      |                           ^ Error: expect(received).toEqual(expected) // deep equality
  98  |     });
  99  |   });
  100 | 
  101 | });
```