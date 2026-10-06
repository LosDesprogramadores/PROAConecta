import { expect, test } from '../fixtures';
import { ESTADO_SESION } from '../fixtures';

test.describe('role boundaries', () => {
  test.use({ storageState: ESTADO_SESION('estudiante') });

  test('a student opening /dashboard-admin is sent back to the student panel', async ({ page }) => {
    await page.goto('/dashboard-admin');

    await expect(page).toHaveURL(/\/dashboard\/estudiante\/welcome$/);
    await expect(page.getByRole('heading', { name: 'Mis Materias' })).toBeVisible();
  });
});
