import { ESTADO_SESION, expect, irASeccion, test } from '../fixtures';

test.describe('student grades', () => {
  test.use({ storageState: ESTADO_SESION('estudiante') });

  test('a student sees their grades and downloads the report card', async ({ page }) => {
    await page.goto('/dashboard/estudiante/welcome');
    await page.getByRole('link', { name: /Matemática/ }).click();
    await expect(page).toHaveURL(/\/view-materia\/\d+\//);
    await irASeccion(page, 'estudiante/calificaciones');

    // Seed data: Emma got 7.00 in the first activity of Matemática, the second one is not graded yet
    const calificada = page.getByRole('row', { name: /Números y operaciones/ });
    await expect(calificada.getByRole('cell', { name: '7.00' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Geometría básica/ })).toContainText('Sin calificar');

    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar boletín' }).click();
    const archivo = await descarga;

    expect(archivo.suggestedFilename()).toMatch(/\.pdf$/i);
    const ruta = await archivo.path();
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(ruta).subarray(0, 4).toString()).toBe('%PDF');
  });
});
