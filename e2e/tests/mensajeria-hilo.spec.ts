import { contextoComo, expect, test, type BrowserContext, type Page } from '../fixtures';

async function abrirMensajesDesdeLaCampana(page: Page, inicio: string): Promise<void> {
  await page.goto(inicio);
  await page.getByRole('button', { name: /^Mensajes/ }).click();
  await page.getByRole('link', { name: 'Ver todos los mensajes' }).click();
  await expect(page).toHaveURL(/\/dashboard\/mensajes$/);
}

/** The professor writes to Emma (Matemática) and both sessions are returned, the student on the thread. */
async function profesorEscribeYEstudianteAbre(
  browser: import('@playwright/test').Browser,
  asunto: string,
  consulta: string,
): Promise<{ profesor: BrowserContext; estudiante: BrowserContext; paginaProfesor: Page; paginaEstudiante: Page }> {
  const profesor = await contextoComo(browser, 'profesor');
  const estudiante = await contextoComo(browser, 'estudiante');
  const paginaProfesor = await profesor.newPage();
  const paginaEstudiante = await estudiante.newPage();

  await abrirMensajesDesdeLaCampana(paginaProfesor, '/dashboard/welcome');
  await paginaProfesor.getByRole('button', { name: 'Nuevo mensaje' }).click();
  const formulario = paginaProfesor.getByRole('dialog', { name: 'Nuevo mensaje' });
  await formulario.getByLabel('Materia').selectOption({ label: 'Matemática' });
  const emma = await formulario.getByRole('option', { name: /Emma/ }).textContent();
  await formulario.getByLabel('Destinatario').selectOption({ label: emma!.trim() });
  await formulario.getByLabel('Asunto').fill(asunto);
  await formulario.getByLabel('Mensaje', { exact: true }).fill(consulta);
  await formulario.getByRole('button', { name: 'Enviar' }).click();
  await paginaProfesor.getByRole('tab', { name: 'Enviados' }).click();
  await expect(paginaProfesor.getByRole('button', { name: new RegExp(asunto) })).toBeVisible();

  await abrirMensajesDesdeLaCampana(paginaEstudiante, '/dashboard/estudiante/welcome');
  await paginaEstudiante.getByRole('button', { name: new RegExp(asunto) }).click();
  await expect(paginaEstudiante.getByRole('region', { name: 'Conversación' }).getByText(consulta, { exact: true })).toBeVisible();
  return { profesor, estudiante, paginaProfesor, paginaEstudiante };
}

/** The thread of a pair of people in one materia keeps earlier messages: only its last two bubbles are ours. */
async function esperarUltimosDos(hilo: import('@playwright/test').Locator, primero: string, segundo: string): Promise<void> {
  await expect
    .poll(async () => {
      const textos = await hilo.allInnerTexts();
      return textos.length >= 2 && textos.at(-2)!.includes(primero) && textos.at(-1)!.includes(segundo);
    })
    .toBe(true);
}

test.describe('message threads', () => {
  test('a student answers with Responder and both sides see the thread in order', async ({ browser }) => {
    const asunto = `Hilo E2E ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const consulta = `Consulta de ${asunto}`;
    const respuesta = `Respuesta de ${asunto}`;
    const { profesor, estudiante, paginaProfesor, paginaEstudiante } = await profesorEscribeYEstudianteAbre(browser, asunto, consulta);

    // "Responder" opens the form with the materia, the recipient and the "Re: ..." subject already set
    await paginaEstudiante.getByRole('button', { name: 'Responder', exact: true }).click();
    const formulario = paginaEstudiante.getByRole('dialog', { name: /mensaje/i });
    await expect(formulario.getByLabel('Asunto')).toHaveValue(`Re: ${asunto}`);
    await formulario.getByLabel('Mensaje', { exact: true }).fill(respuesta);
    await formulario.getByRole('button', { name: 'Enviar' }).click();

    const hiloEstudiante = paginaEstudiante.getByRole('region', { name: 'Conversación' }).getByRole('listitem');
    await esperarUltimosDos(hiloEstudiante, consulta, respuesta);

    // The professor finds the reply in the inbox and sees the same thread, oldest first
    await paginaProfesor.getByRole('tab', { name: 'Recibidos' }).click();
    await paginaProfesor.getByRole('button', { name: new RegExp(`Re: ${asunto}`) }).click();
    const hiloProfesor = paginaProfesor.getByRole('region', { name: 'Conversación' }).getByRole('listitem');
    await esperarUltimosDos(hiloProfesor, consulta, respuesta);

    await profesor.close();
    await estudiante.close();
  });

  // APP BUG (reported, not fixed here): the inline reply <form (ngSubmit)> in mensajes.html has no [formGroup]/NgForm
  // (the component only imports ReactiveFormsModule), so "Enviar respuesta" submits the form natively: the page
  // reloads and no message is sent. test.fail() keeps the suite green while the bug exists and turns red as soon as
  // it is fixed, which is the signal to delete the annotation.
  test('a student answers inline in the thread and the professor sees the reply', async ({ browser }) => {
    test.fail(true, 'inline reply form has no ngSubmit directive: the browser reloads the page instead of sending');
    test.setTimeout(45_000);
    const asunto = `Hilo inline E2E ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const consulta = `Consulta de ${asunto}`;
    const respuesta = `Respuesta de ${asunto}`;
    const { profesor, estudiante, paginaProfesor, paginaEstudiante } = await profesorEscribeYEstudianteAbre(browser, asunto, consulta);

    await paginaEstudiante.locator('#respuesta-hilo').fill(respuesta);
    await paginaEstudiante.getByRole('button', { name: 'Enviar respuesta' }).click();
    await expect(paginaEstudiante.getByRole('region', { name: 'Conversación' }).getByText(respuesta, { exact: true })).toBeVisible();

    await paginaProfesor.getByRole('tab', { name: 'Recibidos' }).click();
    await paginaProfesor.getByRole('button', { name: new RegExp(`Re: ${asunto}`) }).click();
    const hiloProfesor = paginaProfesor.getByRole('region', { name: 'Conversación' }).getByRole('listitem');
    await esperarUltimosDos(hiloProfesor, consulta, respuesta);

    await profesor.close();
    await estudiante.close();
  });
});
