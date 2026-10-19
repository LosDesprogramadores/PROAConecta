# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accesibilidad.spec.ts >> Evaluación de Accesibilidad WCAG 2.2 Nivel AA (ACC) >> Pantallas con sesión de Administrador >> ACC-02: Modal de Nueva Materia (Formulario)
- Location: tests/accesibilidad.spec.ts:78:9

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 58

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
+               "bgColor": "#f1efe8",
+               "contrastRatio": 4.14,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#62748e",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.14 (foreground color: #62748e, background color: #f1efe8, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<body style=\"overflow: hidden;\">",
+                 "target": Array [
+                   "body",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.14 (foreground color: #62748e, background color: #f1efe8, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-sm text-slate-500 mt-1\">Listado de asignaturas, cursos y criterios curriculares.</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "p",
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
  - generic [ref=e3]:
    - banner [ref=e5]:
      - navigation [ref=e6]:
        - generic [ref=e7]:
          - generic [ref=e8]:
            - link "P PROAConecta" [ref=e9] [cursor=pointer]:
              - /url: /dashboard-admin
              - generic [ref=e10]: P
              - generic [ref=e11]: PROAConecta
            - generic [ref=e12]:
              - link "Profesores" [ref=e13] [cursor=pointer]:
                - /url: /dashboard-admin/profesores
              - link "Estudiantes" [ref=e14] [cursor=pointer]:
                - /url: /dashboard-admin/estudiantes
              - link "Materias" [ref=e15] [cursor=pointer]:
                - /url: /dashboard-admin/materias
              - link "Notificaciones" [ref=e16] [cursor=pointer]:
                - /url: /dashboard-admin/notificaciones
          - generic [ref=e17]:
            - generic [ref=e18]: Ana Administradora
            - generic [ref=e19]:
              - button [ref=e20]:
                - img "Foto de perfil" [ref=e21]
              - generic:
                - button "Mi Perfil"
                - separator
                - button "Cerrar sesión"
    - generic [ref=e23]:
      - generic [ref=e24]:
        - generic [ref=e25]:
          - heading "Gestión de Materias" [level=1] [ref=e26]
          - paragraph [ref=e27]: Listado de asignaturas, cursos y criterios curriculares.
        - generic [ref=e28]:
          - group "Exportar listado" [ref=e30]:
            - button "Exportar CSV" [ref=e31] [cursor=pointer]
            - button "Exportar PDF" [ref=e32] [cursor=pointer]
          - button "Nueva Materia" [ref=e33] [cursor=pointer]
      - table [ref=e38]:
        - rowgroup [ref=e39]:
          - row [ref=e40]:
            - columnheader "Materia" [ref=e41]
            - columnheader "Curso" [ref=e42]
            - columnheader "Ciclo Lectivo" [ref=e43]
            - columnheader "Descripción" [ref=e44]
            - columnheader "Acciones" [ref=e45]
        - rowgroup [ref=e46]:
          - row [ref=e47]:
            - cell "Matemática" [ref=e48]
            - cell "1ro A" [ref=e49]
            - cell "2026" [ref=e51]
            - cell "Materia de demostración" [ref=e52]
            - cell [ref=e53]:
              - generic [ref=e54]:
                - button "Consultar" [ref=e55] [cursor=pointer]
                - button "Asignar" [ref=e56] [cursor=pointer]
                - button "Inscribir" [ref=e57] [cursor=pointer]
                - button "Editar" [ref=e58] [cursor=pointer]
                - button "Eliminar" [ref=e59] [cursor=pointer]
          - row [ref=e60]:
            - cell "Lengua y Literatura" [ref=e61]
            - cell "1ro A" [ref=e62]
            - cell "2026" [ref=e64]
            - cell "Materia de demostración" [ref=e65]
            - cell [ref=e66]:
              - generic [ref=e67]:
                - button "Consultar" [ref=e68] [cursor=pointer]
                - button "Asignar" [ref=e69] [cursor=pointer]
                - button "Inscribir" [ref=e70] [cursor=pointer]
                - button "Editar" [ref=e71] [cursor=pointer]
                - button "Eliminar" [ref=e72] [cursor=pointer]
          - row [ref=e73]:
            - cell "Materia E2E 1792398422574-147" [ref=e74]
            - cell "2do B" [ref=e75]
            - cell "2026" [ref=e77]
            - cell "—" [ref=e78]
            - cell [ref=e79]:
              - generic [ref=e80]:
                - button "Consultar" [ref=e81] [cursor=pointer]
                - button "Asignar" [ref=e82] [cursor=pointer]
                - button "Inscribir" [ref=e83] [cursor=pointer]
                - button "Editar" [ref=e84] [cursor=pointer]
                - button "Eliminar" [ref=e85] [cursor=pointer]
          - row [ref=e86]:
            - cell "Materia E2E 1792398631277-566" [ref=e87]
            - cell "2do B" [ref=e88]
            - cell "2026" [ref=e90]
            - cell "—" [ref=e91]
            - cell [ref=e92]:
              - generic [ref=e93]:
                - button "Consultar" [ref=e94] [cursor=pointer]
                - button "Asignar" [ref=e95] [cursor=pointer]
                - button "Inscribir" [ref=e96] [cursor=pointer]
                - button "Editar" [ref=e97] [cursor=pointer]
                - button "Eliminar" [ref=e98] [cursor=pointer]
          - row [ref=e99]:
            - cell "Materia E2E 1792398978673-766" [ref=e100]
            - cell "2do B" [ref=e101]
            - cell "2026" [ref=e103]
            - cell "—" [ref=e104]
            - cell [ref=e105]:
              - generic [ref=e106]:
                - button "Consultar" [ref=e107] [cursor=pointer]
                - button "Asignar" [ref=e108] [cursor=pointer]
                - button "Inscribir" [ref=e109] [cursor=pointer]
                - button "Editar" [ref=e110] [cursor=pointer]
                - button "Eliminar" [ref=e111] [cursor=pointer]
          - row [ref=e112]:
            - cell "Materia E2E 1792399577401-6" [ref=e113]
            - cell "2do B" [ref=e114]
            - cell "2026" [ref=e116]
            - cell "—" [ref=e117]
            - cell [ref=e118]:
              - generic [ref=e119]:
                - button "Consultar" [ref=e120] [cursor=pointer]
                - button "Asignar" [ref=e121] [cursor=pointer]
                - button "Inscribir" [ref=e122] [cursor=pointer]
                - button "Editar" [ref=e123] [cursor=pointer]
                - button "Eliminar" [ref=e124] [cursor=pointer]
      - dialog [ref=e127]:
        - generic [ref=e128]:
          - heading "Registrar Nueva Materia" [level=2] [ref=e130]
          - button "Cerrar" [active] [ref=e131] [cursor=pointer]: ✕
        - generic [ref=e133]:
          - generic [ref=e134]:
            - generic [ref=e135]: Título de la materia *
            - textbox "Título de la materia *" [ref=e136]:
              - /placeholder: "Ej: Desarrollo de Sistemas"
          - generic [ref=e137]:
            - generic [ref=e138]:
              - generic [ref=e139]: Curso *
              - textbox "Curso *" [ref=e140]:
                - /placeholder: "Ej: 1ro A"
            - generic [ref=e141]:
              - generic [ref=e142]: Año Lectivo *
              - spinbutton "Año Lectivo *" [ref=e143]: "2026"
          - generic [ref=e144]:
            - generic [ref=e145]: Descripción
            - textbox "Descripción" [ref=e146]:
              - /placeholder: Breve descripción de la materia...
          - generic [ref=e147]:
            - generic [ref=e148]: Criterios de Evaluación
            - textbox "Criterios de Evaluación" [ref=e149]:
              - /placeholder: Pautas de aprobación, entregas, etc.
          - generic [ref=e150]:
            - generic [ref=e151]: Webhook de Discord
            - textbox "Webhook de Discord" [ref=e152]:
              - /placeholder: https://discord.com/api/webhooks/...
          - generic [ref=e153]:
            - button "Cancelar" [ref=e154] [cursor=pointer]
            - button "Guardar" [disabled] [ref=e155] [cursor=pointer]
    - button "Información del sitio" [ref=e157]:
      - generic [ref=e158]: "?"
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
> 85  |       expect(violaciones).toEqual([]);
      |                           ^ Error: expect(received).toEqual(expected) // deep equality
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
  97  |       expect(violaciones).toEqual([]);
  98  |     });
  99  |   });
  100 | 
  101 | });
```