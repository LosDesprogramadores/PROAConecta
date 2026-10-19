# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mensajeria-hilo.spec.ts >> message threads >> a student answers inline in the thread and the professor sees the reply
- Location: tests/mensajeria-hilo.spec.ts:76:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 10000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - banner [ref=e6]:
      - navigation [ref=e7]:
        - generic [ref=e8]:
          - link "P PROAConecta" [ref=e10] [cursor=pointer]:
            - /url: /dashboard/welcome
            - generic [ref=e11]: P
            - generic [ref=e12]: PROAConecta
          - generic [ref=e13]:
            - generic [ref=e14]:
              - generic [ref=e15]:
                - button "Mensajes" [ref=e16]
                - generic:
                  - generic: Mensajes
                  - generic:
                    - 'link "Estudiante, Emma Re: Hilo inline E2E 1792399590943-5305 19/10/26, 5:46 a. m."':
                      - /url: /dashboard/mensajes
                      - generic [aria-hidden]: E
                      - generic:
                        - paragraph: Estudiante, Emma
                        - paragraph: "Re: Hilo inline E2E 1792399590943-5305"
                        - text: 19/10/26, 5:46 a. m.
                    - 'link "Estudiante, Emma Re: Hilo E2E 1792399587812-7230 19/10/26, 5:46 a. m."':
                      - /url: /dashboard/mensajes
                      - generic [aria-hidden]: E
                      - generic:
                        - paragraph: Estudiante, Emma
                        - paragraph: "Re: Hilo E2E 1792399587812-7230"
                        - text: 19/10/26, 5:46 a. m.
                    - 'link "Estudiante, Emma Re: Hilo inline E2E 1792398987769-4624 19/10/26, 5:36 a. m."':
                      - /url: /dashboard/mensajes
                      - generic [aria-hidden]: E
                      - generic:
                        - paragraph: Estudiante, Emma
                        - paragraph: "Re: Hilo inline E2E 1792398987769-4624"
                        - text: 19/10/26, 5:36 a. m.
                    - 'link "Estudiante, Emma Re: Hilo E2E 1792398984806-5716 19/10/26, 5:36 a. m."':
                      - /url: /dashboard/mensajes
                      - generic [aria-hidden]: E
                      - generic:
                        - paragraph: Estudiante, Emma
                        - paragraph: "Re: Hilo E2E 1792398984806-5716"
                        - text: 19/10/26, 5:36 a. m.
                    - 'link "Estudiante, Emma Re: Hilo inline E2E 1792398640841-5659 19/10/26, 5:30 a. m."':
                      - /url: /dashboard/mensajes
                      - generic [aria-hidden]: E
                      - generic:
                        - paragraph: Estudiante, Emma
                        - paragraph: "Re: Hilo inline E2E 1792398640841-5659"
                        - text: 19/10/26, 5:30 a. m.
                  - generic:
                    - link "Ver todos los mensajes":
                      - /url: /dashboard/mensajes
              - generic [ref=e19]:
                - button "Notificaciones, 4 sin leer" [ref=e20]:
                  - generic [ref=e23]: "4"
                - generic:
                  - generic:
                    - generic: Notificaciones
                    - generic: 4 sin leer
                  - generic:
                    - generic:
                      - generic:
                        - paragraph: Aviso E2E 1792399583712
                        - paragraph: Mensaje de prueba end-to-end.
                        - generic:
                          - generic: 19/10/26, 8:46 a. m.
                          - button "Marcar como leída"
                    - generic:
                      - generic:
                        - paragraph: Aviso E2E 1792398981169
                        - paragraph: Mensaje de prueba end-to-end.
                        - generic:
                          - generic: 19/10/26, 8:36 a. m.
                          - button "Marcar como leída"
                    - generic:
                      - generic:
                        - paragraph: Aviso E2E 1792398633938
                        - paragraph: Mensaje de prueba end-to-end.
                        - generic:
                          - generic: 19/10/26, 8:30 a. m.
                          - button "Marcar como leída"
                    - generic:
                      - generic:
                        - paragraph: Aviso E2E 1792398424386
                        - paragraph: Mensaje de prueba end-to-end.
                        - generic:
                          - generic: 19/10/26, 8:27 a. m.
                          - button "Marcar como leída"
                  - generic:
                    - link "Ver todas las notificaciones":
                      - /url: /dashboard/anuncios
            - generic [ref=e24]: Pablo Profesor
            - generic [ref=e25]:
              - button [ref=e26]:
                - img "Foto de perfil" [ref=e27]
              - generic:
                - button "Mi Perfil"
                - separator
                - button "Cerrar sesión"
    - main [ref=e29]:
      - generic [ref=e31]:
        - generic [ref=e32]:
          - generic [ref=e33]:
            - heading "Mensajes" [level=1] [ref=e34]
            - paragraph [ref=e35]: Comunícate de forma directa con estudiantes y profesores de tus materias.
          - button "Nuevo mensaje" [ref=e36]
        - generic [ref=e37]:
          - generic [ref=e38]:
            - tablist "Bandeja" [ref=e39]:
              - tab "Recibidos" [selected] [ref=e40]
              - tab "Enviados" [ref=e41]
            - tabpanel "Recibidos" [ref=e42]:
              - list [ref=e43]:
                - listitem [ref=e44]:
                  - 'button "Estudiante, Emma 19/10/26, 5:46 a. m. Re: Hilo inline E2E 1792399590943-5305 Matemática" [active] [ref=e45]':
                    - generic [aria-hidden] [ref=e46]: E
                    - generic [ref=e47]:
                      - generic [ref=e48]:
                        - generic [ref=e49]: Estudiante, Emma
                        - generic [ref=e50]: 19/10/26, 5:46 a. m.
                      - paragraph [ref=e51]: "Re: Hilo inline E2E 1792399590943-5305"
                      - generic [ref=e52]: Matemática
                - listitem [ref=e54]:
                  - 'button "Estudiante, Emma 19/10/26, 5:46 a. m. Re: Hilo E2E 1792399587812-7230 Matemática" [ref=e55]':
                    - generic [aria-hidden] [ref=e56]: E
                    - generic [ref=e57]:
                      - generic [ref=e58]:
                        - generic [ref=e59]: Estudiante, Emma
                        - generic [ref=e60]: 19/10/26, 5:46 a. m.
                      - paragraph [ref=e61]: "Re: Hilo E2E 1792399587812-7230"
                      - generic [ref=e62]: Matemática
                - listitem [ref=e64]:
                  - 'button "Estudiante, Emma 19/10/26, 5:36 a. m. Re: Hilo inline E2E 1792398987769-4624 Matemática" [ref=e65]':
                    - generic [aria-hidden] [ref=e66]: E
                    - generic [ref=e67]:
                      - generic [ref=e68]:
                        - generic [ref=e69]: Estudiante, Emma
                        - generic [ref=e70]: 19/10/26, 5:36 a. m.
                      - paragraph [ref=e71]: "Re: Hilo inline E2E 1792398987769-4624"
                      - generic [ref=e72]: Matemática
                - listitem [ref=e74]:
                  - 'button "Estudiante, Emma 19/10/26, 5:36 a. m. Re: Hilo E2E 1792398984806-5716 Matemática" [ref=e75]':
                    - generic [aria-hidden] [ref=e76]: E
                    - generic [ref=e77]:
                      - generic [ref=e78]:
                        - generic [ref=e79]: Estudiante, Emma
                        - generic [ref=e80]: 19/10/26, 5:36 a. m.
                      - paragraph [ref=e81]: "Re: Hilo E2E 1792398984806-5716"
                      - generic [ref=e82]: Matemática
                - listitem [ref=e84]:
                  - 'button "Estudiante, Emma 19/10/26, 5:30 a. m. Re: Hilo inline E2E 1792398640841-5659 Matemática" [ref=e85]':
                    - generic [aria-hidden] [ref=e86]: E
                    - generic [ref=e87]:
                      - generic [ref=e88]:
                        - generic [ref=e89]: Estudiante, Emma
                        - generic [ref=e90]: 19/10/26, 5:30 a. m.
                      - paragraph [ref=e91]: "Re: Hilo inline E2E 1792398640841-5659"
                      - generic [ref=e92]: Matemática
                - listitem [ref=e94]:
                  - 'button "Estudiante, Emma 19/10/26, 5:30 a. m. Re: Hilo E2E 1792398637825-5258 Matemática" [ref=e95]':
                    - generic [aria-hidden] [ref=e96]: E
                    - generic [ref=e97]:
                      - generic [ref=e98]:
                        - generic [ref=e99]: Estudiante, Emma
                        - generic [ref=e100]: 19/10/26, 5:30 a. m.
                      - paragraph [ref=e101]: "Re: Hilo E2E 1792398637825-5258"
                      - generic [ref=e102]: Matemática
                - listitem [ref=e104]:
                  - 'button "Estudiante, Emma 19/10/26, 5:27 a. m. Re: Hilo inline E2E 1792398430193-277 Matemática" [ref=e105]':
                    - generic [aria-hidden] [ref=e106]: E
                    - generic [ref=e107]:
                      - generic [ref=e108]:
                        - generic [ref=e109]: Estudiante, Emma
                        - generic [ref=e110]: 19/10/26, 5:27 a. m.
                      - paragraph [ref=e111]: "Re: Hilo inline E2E 1792398430193-277"
                      - generic [ref=e112]: Matemática
                - listitem [ref=e114]:
                  - 'button "Estudiante, Emma 19/10/26, 5:27 a. m. Re: Hilo E2E 1792398427543-2828 Matemática" [ref=e115]':
                    - generic [aria-hidden] [ref=e116]: E
                    - generic [ref=e117]:
                      - generic [ref=e118]:
                        - generic [ref=e119]: Estudiante, Emma
                        - generic [ref=e120]: 19/10/26, 5:27 a. m.
                      - paragraph [ref=e121]: "Re: Hilo E2E 1792398427543-2828"
                      - generic [ref=e122]: Matemática
          - generic [ref=e124]:
            - generic [ref=e125]:
              - generic [ref=e126]:
                - 'heading "Re: Hilo inline E2E 1792399590943-5305" [level=2] [ref=e127]'
                - paragraph [ref=e128]: De Estudiante, Emma para Profesor, Pablo · Matemática · 19 oct 2026, 5:46:37 a. m.
              - button "Responder" [ref=e130]
            - region "Conversación" [ref=e131]:
              - list [ref=e132]:
                - listitem [ref=e133]:
                  - generic [ref=e134]:
                    - paragraph [ref=e135]: Consulta E2E 1792398427675
                    - paragraph [ref=e136]: Cuerpo de Consulta E2E 1792398427675
                    - paragraph [ref=e137]: 19/10/26, 5:27 a. m.
                - listitem [ref=e138]:
                  - generic [ref=e139]:
                    - paragraph [ref=e140]: Hilo E2E 1792398427543-2828
                    - paragraph [ref=e141]: Consulta de Hilo E2E 1792398427543-2828
                    - paragraph [ref=e142]: 19/10/26, 5:27 a. m.
                - listitem [ref=e143]:
                  - generic [ref=e144]:
                    - paragraph [ref=e145]: "Re: Hilo E2E 1792398427543-2828"
                    - paragraph [ref=e146]: Respuesta de Hilo E2E 1792398427543-2828
                    - paragraph [ref=e147]: 19/10/26, 5:27 a. m.
                - listitem [ref=e148]:
                  - generic [ref=e149]:
                    - paragraph [ref=e150]: Hilo inline E2E 1792398430193-277
                    - paragraph [ref=e151]: Consulta de Hilo inline E2E 1792398430193-277
                    - paragraph [ref=e152]: 19/10/26, 5:27 a. m.
                - listitem [ref=e153]:
                  - generic [ref=e154]:
                    - paragraph [ref=e155]: "Re: Hilo inline E2E 1792398430193-277"
                    - paragraph [ref=e156]: Respuesta de Hilo inline E2E 1792398430193-277
                    - paragraph [ref=e157]: 19/10/26, 5:27 a. m.
                - listitem [ref=e158]:
                  - generic [ref=e159]:
                    - paragraph [ref=e160]: Consulta E2E 1792398637578
                    - paragraph [ref=e161]: Cuerpo de Consulta E2E 1792398637578
                    - paragraph [ref=e162]: 19/10/26, 5:30 a. m.
                - listitem [ref=e163]:
                  - generic [ref=e164]:
                    - paragraph [ref=e165]: Hilo E2E 1792398637825-5258
                    - paragraph [ref=e166]: Consulta de Hilo E2E 1792398637825-5258
                    - paragraph [ref=e167]: 19/10/26, 5:30 a. m.
                - listitem [ref=e168]:
                  - generic [ref=e169]:
                    - paragraph [ref=e170]: "Re: Hilo E2E 1792398637825-5258"
                    - paragraph [ref=e171]: Respuesta de Hilo E2E 1792398637825-5258
                    - paragraph [ref=e172]: 19/10/26, 5:30 a. m.
                - listitem [ref=e173]:
                  - generic [ref=e174]:
                    - paragraph [ref=e175]: Hilo inline E2E 1792398640841-5659
                    - paragraph [ref=e176]: Consulta de Hilo inline E2E 1792398640841-5659
                    - paragraph [ref=e177]: 19/10/26, 5:30 a. m.
                - listitem [ref=e178]:
                  - generic [ref=e179]:
                    - paragraph [ref=e180]: "Re: Hilo inline E2E 1792398640841-5659"
                    - paragraph [ref=e181]: Respuesta de Hilo inline E2E 1792398640841-5659
                    - paragraph [ref=e182]: 19/10/26, 5:30 a. m.
                - listitem [ref=e183]:
                  - generic [ref=e184]:
                    - paragraph [ref=e185]: Consulta E2E 1792398985085
                    - paragraph [ref=e186]: Cuerpo de Consulta E2E 1792398985085
                    - paragraph [ref=e187]: 19/10/26, 5:36 a. m.
                - listitem [ref=e188]:
                  - generic [ref=e189]:
                    - paragraph [ref=e190]: Hilo E2E 1792398984806-5716
                    - paragraph [ref=e191]: Consulta de Hilo E2E 1792398984806-5716
                    - paragraph [ref=e192]: 19/10/26, 5:36 a. m.
                - listitem [ref=e193]:
                  - generic [ref=e194]:
                    - paragraph [ref=e195]: "Re: Hilo E2E 1792398984806-5716"
                    - paragraph [ref=e196]: Respuesta de Hilo E2E 1792398984806-5716
                    - paragraph [ref=e197]: 19/10/26, 5:36 a. m.
                - listitem [ref=e198]:
                  - generic [ref=e199]:
                    - paragraph [ref=e200]: Hilo inline E2E 1792398987769-4624
                    - paragraph [ref=e201]: Consulta de Hilo inline E2E 1792398987769-4624
                    - paragraph [ref=e202]: 19/10/26, 5:36 a. m.
                - listitem [ref=e203]:
                  - generic [ref=e204]:
                    - paragraph [ref=e205]: "Re: Hilo inline E2E 1792398987769-4624"
                    - paragraph [ref=e206]: Respuesta de Hilo inline E2E 1792398987769-4624
                    - paragraph [ref=e207]: 19/10/26, 5:36 a. m.
                - listitem [ref=e208]:
                  - generic [ref=e209]:
                    - paragraph [ref=e210]: Hilo E2E 1792399587812-7230
                    - paragraph [ref=e211]: Consulta de Hilo E2E 1792399587812-7230
                    - paragraph [ref=e212]: 19/10/26, 5:46 a. m.
                - listitem [ref=e213]:
                  - generic [ref=e214]:
                    - paragraph [ref=e215]: "Re: Hilo E2E 1792399587812-7230"
                    - paragraph [ref=e216]: Respuesta de Hilo E2E 1792399587812-7230
                    - paragraph [ref=e217]: 19/10/26, 5:46 a. m.
                - listitem [ref=e218]:
                  - generic [ref=e219]:
                    - paragraph [ref=e220]: Hilo inline E2E 1792399590943-5305
                    - paragraph [ref=e221]: Consulta de Hilo inline E2E 1792399590943-5305
                    - paragraph [ref=e222]: 19/10/26, 5:46 a. m.
                - listitem [ref=e223]:
                  - generic [ref=e224]:
                    - paragraph [ref=e225]: Consulta E2E 1792399596391
                    - paragraph [ref=e226]: Cuerpo de Consulta E2E 1792399596391
                    - paragraph [ref=e227]: 19/10/26, 5:46 a. m.
                - listitem [ref=e228]:
                  - generic [ref=e229]:
                    - paragraph [ref=e230]: "Re: Hilo inline E2E 1792399590943-5305"
                    - paragraph [ref=e231]: Respuesta de Hilo inline E2E 1792399590943-5305
                    - paragraph [ref=e232]: 19/10/26, 5:46 a. m.
            - generic [ref=e233]:
              - generic [ref=e234]: Responder a Estudiante, Emma
              - textbox "Responder a Estudiante, Emma" [ref=e235]
              - button "Enviar respuesta" [disabled] [ref=e237]
    - button "Información del sitio" [ref=e239]:
      - generic [ref=e240]: "?"
  - generic:
    - complementary
```

# Test source

```ts
  1  | import { contextoComo, expect, test, type BrowserContext, type Page } from '../fixtures';
  2  | 
  3  | async function abrirMensajesDesdeLaCampana(page: Page, inicio: string): Promise<void> {
  4  |   await page.goto(inicio);
  5  |   await page.getByRole('button', { name: /^Mensajes/ }).click();
  6  |   await page.getByRole('link', { name: 'Ver todos los mensajes' }).click();
  7  |   await expect(page).toHaveURL(/\/dashboard\/mensajes$/);
  8  | }
  9  | 
  10 | /** The professor writes to Emma (Matemática) and both sessions are returned, the student on the thread. */
  11 | async function profesorEscribeYEstudianteAbre(
  12 |   browser: import('@playwright/test').Browser,
  13 |   asunto: string,
  14 |   consulta: string,
  15 | ): Promise<{ profesor: BrowserContext; estudiante: BrowserContext; paginaProfesor: Page; paginaEstudiante: Page }> {
  16 |   const profesor = await contextoComo(browser, 'profesor');
  17 |   const estudiante = await contextoComo(browser, 'estudiante');
  18 |   const paginaProfesor = await profesor.newPage();
  19 |   const paginaEstudiante = await estudiante.newPage();
  20 | 
  21 |   await abrirMensajesDesdeLaCampana(paginaProfesor, '/dashboard/welcome');
  22 |   await paginaProfesor.getByRole('button', { name: 'Nuevo mensaje' }).click();
  23 |   const formulario = paginaProfesor.getByRole('dialog', { name: 'Nuevo mensaje' });
  24 |   await formulario.getByLabel('Materia').selectOption({ label: 'Matemática' });
  25 |   const emma = await formulario.getByRole('option', { name: /Emma/ }).textContent();
  26 |   await formulario.getByLabel('Destinatario').selectOption({ label: emma!.trim() });
  27 |   await formulario.getByLabel('Asunto').fill(asunto);
  28 |   await formulario.getByLabel('Mensaje', { exact: true }).fill(consulta);
  29 |   await formulario.getByRole('button', { name: 'Enviar' }).click();
  30 |   await paginaProfesor.getByRole('tab', { name: 'Enviados' }).click();
  31 |   await expect(paginaProfesor.getByRole('button', { name: new RegExp(asunto) })).toBeVisible();
  32 | 
  33 |   await abrirMensajesDesdeLaCampana(paginaEstudiante, '/dashboard/estudiante/welcome');
  34 |   await paginaEstudiante.getByRole('button', { name: new RegExp(asunto) }).click();
  35 |   await expect(paginaEstudiante.getByRole('region', { name: 'Conversación' }).getByText(consulta, { exact: true })).toBeVisible();
  36 |   return { profesor, estudiante, paginaProfesor, paginaEstudiante };
  37 | }
  38 | 
  39 | /** The thread of a pair of people in one materia keeps earlier messages: only its last two bubbles are ours. */
  40 | async function esperarUltimosDos(hilo: import('@playwright/test').Locator, primero: string, segundo: string): Promise<void> {
  41 |   await expect
  42 |     .poll(async () => {
  43 |       const textos = await hilo.allInnerTexts();
  44 |       return textos.length >= 2 && textos.at(-2)!.includes(primero) && textos.at(-1)!.includes(segundo);
  45 |     })
> 46 |     .toBe(true);
     |      ^ Error: expect(received).toBe(expected) // Object.is equality
  47 | }
  48 | 
  49 | test.describe('message threads', () => {
  50 |   test('a student answers with Responder and both sides see the thread in order', async ({ browser }) => {
  51 |     const asunto = `Hilo E2E ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  52 |     const consulta = `Consulta de ${asunto}`;
  53 |     const respuesta = `Respuesta de ${asunto}`;
  54 |     const { profesor, estudiante, paginaProfesor, paginaEstudiante } = await profesorEscribeYEstudianteAbre(browser, asunto, consulta);
  55 | 
  56 |     // "Responder" opens the form with the materia, the recipient and the "Re: ..." subject already set
  57 |     await paginaEstudiante.getByRole('button', { name: 'Responder', exact: true }).click();
  58 |     const formulario = paginaEstudiante.getByRole('dialog', { name: /mensaje/i });
  59 |     await expect(formulario.getByLabel('Asunto')).toHaveValue(`Re: ${asunto}`);
  60 |     await formulario.getByLabel('Mensaje', { exact: true }).fill(respuesta);
  61 |     await formulario.getByRole('button', { name: 'Enviar' }).click();
  62 | 
  63 |     const hiloEstudiante = paginaEstudiante.getByRole('region', { name: 'Conversación' }).getByRole('listitem');
  64 |     await esperarUltimosDos(hiloEstudiante, consulta, respuesta);
  65 | 
  66 |     // The professor finds the reply in the inbox and sees the same thread, oldest first
  67 |     await paginaProfesor.getByRole('tab', { name: 'Recibidos' }).click();
  68 |     await paginaProfesor.getByRole('button', { name: new RegExp(`Re: ${asunto}`) }).click();
  69 |     const hiloProfesor = paginaProfesor.getByRole('region', { name: 'Conversación' }).getByRole('listitem');
  70 |     await esperarUltimosDos(hiloProfesor, consulta, respuesta);
  71 | 
  72 |     await profesor.close();
  73 |     await estudiante.close();
  74 |   });
  75 | 
  76 |   test('a student answers inline in the thread and the professor sees the reply', async ({ browser }) => {
  77 |     test.setTimeout(45_000);
  78 |     const asunto = `Hilo inline E2E ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  79 |     const consulta = `Consulta de ${asunto}`;
  80 |     const respuesta = `Respuesta de ${asunto}`;
  81 |     const { profesor, estudiante, paginaProfesor, paginaEstudiante } = await profesorEscribeYEstudianteAbre(browser, asunto, consulta);
  82 | 
  83 |     await paginaEstudiante.locator('#respuesta-hilo').fill(respuesta);
  84 |     await paginaEstudiante.getByRole('button', { name: 'Enviar respuesta' }).click();
  85 |     await expect(paginaEstudiante.getByRole('region', { name: 'Conversación' }).getByText(respuesta, { exact: true })).toBeVisible();
  86 | 
  87 |     await paginaProfesor.getByRole('tab', { name: 'Recibidos' }).click();
  88 |     await paginaProfesor.getByRole('button', { name: new RegExp(`Re: ${asunto}`) }).click();
  89 |     const hiloProfesor = paginaProfesor.getByRole('region', { name: 'Conversación' }).getByRole('listitem');
  90 |     await esperarUltimosDos(hiloProfesor, consulta, respuesta);
  91 | 
  92 |     await profesor.close();
  93 |     await estudiante.close();
  94 |   });
  95 | });
  96 | 
```