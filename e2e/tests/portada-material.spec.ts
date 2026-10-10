import { ESTADO_SESION, expect, test } from '../fixtures';

test.describe('student materia cover', () => {
  test.use({ storageState: ESTADO_SESION('estudiante') });

  test('a student reaches the Material from another section through the navbar Portada link', async ({ page }) => {
    await page.goto('/dashboard/estudiante/welcome');
    await page.getByRole('link', { name: /Matemática/ }).click();
    await expect(page).toHaveURL(/\/view-materia\/\d+\//);

    // Leave the cover through a section link, then come back with real clicks (no URL navigation)
    await page.getByRole('link', { name: 'Calificaciones' }).click();
    await expect(page.getByRole('button', { name: 'Descargar boletín' })).toBeVisible();

    await page.getByRole('link', { name: 'Portada' }).click();
    await expect(page.getByRole('heading', { name: 'Programa y Unidades' })).toBeVisible();

    // Seed data: the first unit of Matemática holds the material; the toggle is a real button
    const unidad = page.getByRole('button', { name: 'Números y operaciones' });
    await expect(unidad).toBeVisible();
    await expect(unidad).toHaveAttribute('aria-expanded', 'false');
    await unidad.click();
    await expect(unidad).toHaveAttribute('aria-expanded', 'true');
  });
});
