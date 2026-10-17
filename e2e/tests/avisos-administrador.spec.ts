import { contextoComo, expect, test, type Page } from '../fixtures';

/** `YYYY-MM-DD` one day after the given date (calendar arithmetic, no time zone involved). */
function diaSiguiente(dia: string): string {
  const fecha = new Date(`${dia}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString().slice(0, 10);
}

/** Creates a notice for students from the admin form. `desdeManana` moves "Vigente desde" one day ahead. */
async function crearAviso(page: Page, titulo: string, desdeManana: boolean): Promise<void> {
  await page.goto('/dashboard-admin');
  await page.getByRole('link', { name: 'Notificaciones', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva Notificación Global' }).click();

  await page.getByLabel(/Título de la Notificación/).fill(titulo);
  await page.getByLabel(/Contenido \/ Mensaje/).fill('Aviso creado por la prueba end-to-end.');
  await page.getByLabel(/Dirigido a/).selectOption({ label: 'Estudiantes' });
  const desde = page.getByLabel(/Vigente desde/);
  if (desdeManana) {
    // The form starts on today's date: take it as the reference so the test does not depend on the time zone
    await desde.fill(diaSiguiente(await desde.inputValue()));
    await expect(desde.locator('..').getByText(/Programada para/)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Publicar Notificación Global' }).click();
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
}

/** The student reaches the full list through the bell menu, like a person would. */
async function abrirAnunciosDelEstudiante(page: Page): Promise<void> {
  await page.goto('/dashboard/estudiante/welcome');
  await page.getByRole('button', { name: /^Notificaciones/ }).click();
  await page.getByRole('link', { name: 'Ver todas las notificaciones' }).click();
  await expect(page).toHaveURL(/\/dashboard\/anuncios$/);
  await expect(page.getByRole('heading', { name: 'Anuncios', level: 1 })).toBeVisible();
  await expect(page.getByText('Cargando notificaciones...')).toHaveCount(0);
}

test.describe('admin notices', () => {
  test('a notice for students valid from today is visible to a student in /dashboard/anuncios', async ({ browser }) => {
    const titulo = `Aviso vigente E2E ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const admin = await contextoComo(browser, 'admin');
    const estudiante = await contextoComo(browser, 'estudiante');
    const paginaAdmin = await admin.newPage();
    const paginaEstudiante = await estudiante.newPage();

    await crearAviso(paginaAdmin, titulo, false);
    await abrirAnunciosDelEstudiante(paginaEstudiante);

    await expect(paginaEstudiante.getByRole('heading', { name: titulo })).toBeVisible();
    await admin.close();
    await estudiante.close();
  });

  test('a notice valid from tomorrow is Programada for the admin and invisible to a student', async ({ browser }) => {
    const sufijo = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const programado = `Aviso programado E2E ${sufijo}`;
    const vigente = `Aviso control E2E ${sufijo}`;
    const admin = await contextoComo(browser, 'admin');
    const estudiante = await contextoComo(browser, 'estudiante');
    const paginaAdmin = await admin.newPage();
    const paginaEstudiante = await estudiante.newPage();

    await crearAviso(paginaAdmin, programado, true);
    const tarjeta = paginaAdmin.getByRole('heading', { name: programado }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await expect(tarjeta).toContainText('Programada');

    // A control notice published now proves the list was loaded before checking the absence of the other one
    await crearAviso(paginaAdmin, vigente, false);
    await abrirAnunciosDelEstudiante(paginaEstudiante);
    await expect(paginaEstudiante.getByRole('heading', { name: vigente })).toBeVisible();
    await expect(paginaEstudiante.getByRole('heading', { name: programado })).toHaveCount(0);

    await admin.close();
    await estudiante.close();
  });
});
