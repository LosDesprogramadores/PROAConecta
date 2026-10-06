import { contextoComo, expect, test } from '../fixtures';

test('a professor sends a message and the student sees it (two browser sessions)', async ({ browser }) => {
  const asunto = `Consulta E2E ${Date.now()}`;
  const cuerpo = `Cuerpo de ${asunto}`;
  const profesor = await contextoComo(browser, 'profesor');
  const estudiante = await contextoComo(browser, 'estudiante');
  const paginaProfesor = await profesor.newPage();
  const paginaEstudiante = await estudiante.newPage();

  await paginaProfesor.goto('/dashboard/mensajes');
  await paginaProfesor.getByRole('button', { name: 'Nuevo mensaje' }).click();
  const formulario = paginaProfesor.getByRole('dialog', { name: 'Nuevo mensaje' });
  await formulario.getByLabel('Materia').selectOption({ label: 'Matemática' });
  const emma = await formulario.getByRole('option', { name: /Emma/ }).textContent();
  await formulario.getByLabel('Destinatario').selectOption({ label: emma!.trim() });
  await formulario.getByLabel('Asunto').fill(asunto);
  await formulario.getByLabel('Mensaje', { exact: true }).fill(cuerpo);
  await formulario.getByRole('button', { name: 'Enviar' }).click();

  await paginaProfesor.getByRole('tab', { name: 'Enviados' }).click();
  await expect(paginaProfesor.getByRole('button', { name: new RegExp(asunto) })).toBeVisible();

  await paginaEstudiante.goto('/dashboard/mensajes');
  const recibido = paginaEstudiante.getByRole('button', { name: new RegExp(asunto) });
  await expect(recibido).toBeVisible();
  await recibido.click();
  await expect(paginaEstudiante.getByRole('heading', { name: asunto })).toBeVisible();
  await expect(paginaEstudiante.getByRole('main').getByText(cuerpo, { exact: true })).toBeVisible();

  await profesor.close();
  await estudiante.close();
});
