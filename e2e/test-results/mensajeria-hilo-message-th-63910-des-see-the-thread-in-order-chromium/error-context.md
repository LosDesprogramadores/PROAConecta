# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mensajeria-hilo.spec.ts >> message threads >> a student answers with Responder and both sides see the thread in order
- Location: tests/mensajeria-hilo.spec.ts:50:7

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
                - button "Mensajes, 1 sin leer" [ref=e16]:
                  - generic [aria-hidden] [ref=e19]: "1"
                - generic:
                  - generic:
                    - generic: Mensajes
                    - generic: 1 sin leer
                  - generic:
                    - 'link "Estudiante, Emma Re: Hilo E2E 1792396159525-7985 19/10/26, 4:49 a. m."':
                      - /url: /dashboard/mensajes
                      - generic [aria-hidden]: E
                      - generic:
                        - paragraph: Estudiante, Emma
                        - paragraph: "Re: Hilo E2E 1792396159525-7985"
                        - text: 19/10/26, 4:49 a. m.
                    - 'link "Estudiante, Emma Re: Hilo inline E2E 1792394932974-809 19/10/26, 4:28 a. m."':
                      - /url: /dashboard/mensajes
                      - generic [aria-hidden]: E
                      - generic:
                        - paragraph: Estudiante, Emma
                        - paragraph: "Re: Hilo inline E2E 1792394932974-809"
                        - text: 19/10/26, 4:28 a. m.
                    - 'link "Estudiante, Emma Re: Hilo E2E 1792394930423-5559 19/10/26, 4:28 a. m."':
                      - /url: /dashboard/mensajes
                      - generic [aria-hidden]: E
                      - generic:
                        - paragraph: Estudiante, Emma
                        - paragraph: "Re: Hilo E2E 1792394930423-5559"
                        - text: 19/10/26, 4:28 a. m.
                  - generic:
                    - link "Ver todos los mensajes":
                      - /url: /dashboard/mensajes
              - generic [ref=e20]:
                - button "Notificaciones, 2 sin leer" [ref=e21]:
                  - generic [ref=e24]: "2"
                - generic:
                  - generic:
                    - generic: Notificaciones
                    - generic: 2 sin leer
                  - generic:
                    - generic:
                      - generic:
                        - paragraph: Aviso E2E 1792396156568
                        - paragraph: Mensaje de prueba end-to-end.
                        - generic:
                          - generic: 19/10/26, 7:49 a. m.
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
            - generic [ref=e25]: Pablo Profesor
            - generic [ref=e26]:
              - button [ref=e27]:
                - img "Foto de perfil" [ref=e28]
              - generic:
                - button "Mi Perfil"
                - separator
                - button "Cerrar sesión"
    - main [ref=e30]:
      - generic [ref=e32]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - heading "Mensajes" [level=1] [ref=e35]
            - paragraph [ref=e36]: Comunícate de forma directa con estudiantes y profesores de tus materias.
          - button "Nuevo mensaje" [ref=e37]
        - generic [ref=e38]:
          - generic [ref=e39]:
            - tablist "Bandeja" [ref=e40]:
              - tab "Recibidos 1 sin leer" [ref=e41]:
                - text: Recibidos
                - generic "1 sin leer" [ref=e42]: "1"
              - tab "Enviados" [active] [selected] [ref=e43]
            - tabpanel "Enviados" [ref=e44]:
              - list [ref=e45]:
                - listitem [ref=e46]:
                  - button "Estudiante, Emma 19/10/26, 4:49 a. m. Consulta E2E 1792396159968 Matemática Leído" [ref=e47]:
                    - generic [aria-hidden] [ref=e48]: E
                    - generic [ref=e49]:
                      - generic [ref=e50]:
                        - generic [ref=e51]: Estudiante, Emma
                        - generic [ref=e52]: 19/10/26, 4:49 a. m.
                      - paragraph [ref=e53]: Consulta E2E 1792396159968
                      - generic [ref=e54]:
                        - generic [ref=e55]: Matemática
                        - generic [ref=e56]: Leído
                - listitem [ref=e57]:
                  - button "Estudiante, Emma 19/10/26, 4:49 a. m. Hilo E2E 1792396159525-7985 Matemática Leído" [ref=e58]:
                    - generic [aria-hidden] [ref=e59]: E
                    - generic [ref=e60]:
                      - generic [ref=e61]:
                        - generic [ref=e62]: Estudiante, Emma
                        - generic [ref=e63]: 19/10/26, 4:49 a. m.
                      - paragraph [ref=e64]: Hilo E2E 1792396159525-7985
                      - generic [ref=e65]:
                        - generic [ref=e66]: Matemática
                        - generic [ref=e67]: Leído
                - listitem [ref=e68]:
                  - button "Estudiante, Emma 19/10/26, 4:28 a. m. Hilo inline E2E 1792394932974-809 Matemática Leído" [ref=e69]:
                    - generic [aria-hidden] [ref=e70]: E
                    - generic [ref=e71]:
                      - generic [ref=e72]:
                        - generic [ref=e73]: Estudiante, Emma
                        - generic [ref=e74]: 19/10/26, 4:28 a. m.
                      - paragraph [ref=e75]: Hilo inline E2E 1792394932974-809
                      - generic [ref=e76]:
                        - generic [ref=e77]: Matemática
                        - generic [ref=e78]: Leído
                - listitem [ref=e79]:
                  - button "Estudiante, Emma 19/10/26, 4:28 a. m. Hilo E2E 1792394930423-5559 Matemática Leído" [ref=e80]:
                    - generic [aria-hidden] [ref=e81]: E
                    - generic [ref=e82]:
                      - generic [ref=e83]:
                        - generic [ref=e84]: Estudiante, Emma
                        - generic [ref=e85]: 19/10/26, 4:28 a. m.
                      - paragraph [ref=e86]: Hilo E2E 1792394930423-5559
                      - generic [ref=e87]:
                        - generic [ref=e88]: Matemática
                        - generic [ref=e89]: Leído
                - listitem [ref=e90]:
                  - button "Estudiante, Emma 19/10/26, 4:28 a. m. Consulta E2E 1792394930817 Matemática Leído" [ref=e91]:
                    - generic [aria-hidden] [ref=e92]: E
                    - generic [ref=e93]:
                      - generic [ref=e94]:
                        - generic [ref=e95]: Estudiante, Emma
                        - generic [ref=e96]: 19/10/26, 4:28 a. m.
                      - paragraph [ref=e97]: Consulta E2E 1792394930817
                      - generic [ref=e98]:
                        - generic [ref=e99]: Matemática
                        - generic [ref=e100]: Leído
          - paragraph [ref=e103]: Selecciona un mensaje para leerlo.
    - button "Información del sitio" [ref=e105]:
      - generic [ref=e106]: "?"
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