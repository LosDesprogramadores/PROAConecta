import { abrirMateria, contextoComo, expect, test } from '../fixtures';

// The second test needs the announcement published by the first: they run in order and retry together
test.describe.configure({ mode: 'serial' });

test.describe('announcements', () => {
  const titulo = `Aviso E2E ${Date.now()}`;

  test('a professor opens a materia, sees its students and publishes an announcement', async ({ browser }) => {
    const contexto = await contextoComo(browser, 'profesor');
    const page = await contexto.newPage();

    await abrirMateria(page, 'Matemática');
    await page.getByRole('link', { name: 'Alumnos' }).click();
    await expect(page.getByRole('heading', { name: 'Alumnos', level: 1 })).toBeVisible();
    await expect(page.getByRole('row', { name: /Emma/ })).toBeVisible();

    await page.getByRole('link', { name: 'Anuncios' }).click();
    await page.getByRole('textbox', { name: 'Título' }).fill(titulo);
    await page.getByRole('textbox', { name: 'Mensaje' }).fill('Mensaje de prueba end-to-end.');
    await page.getByRole('button', { name: 'Publicar anuncio' }).click();

    await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
    await contexto.close();
  });

  test('an enrolled student sees the announcement', async ({ browser }) => {
    const contexto = await contextoComo(browser, 'estudiante');
    const page = await contexto.newPage();

    await page.goto('/dashboard/estudiante/welcome');
    await page.getByRole('link', { name: /Matemática/ }).click();
    await expect(page).toHaveURL(/\/view-materia\/\d+\//);
    await page.getByRole('link', { name: 'Anuncios' }).click();

    await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
    // Students cannot publish
    await expect(page.getByRole('button', { name: 'Publicar anuncio' })).toHaveCount(0);
    await contexto.close();
  });
});
