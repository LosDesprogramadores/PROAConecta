import { expect, test as setup } from '@playwright/test';
import { CUENTAS, DEMO_PASSWORD, ESTADO_SESION, completarLogin, type Rol } from '../fixtures';

// One real UI login per role. Besides proving that each role lands on its own panel, it stores the session
// so the other tests start already logged in (the per-account login throttle allows 10 logins/hour).
for (const rol of Object.keys(CUENTAS) as Rol[]) {
  setup(`login: ${rol} lands on its panel`, async ({ page }) => {
    const cuenta = CUENTAS[rol];
    await completarLogin(page, cuenta.dni, DEMO_PASSWORD);

    await expect(page).toHaveURL(cuenta.panel);
    await expect(page.getByText(cuenta.saludo).first()).toBeVisible();

    await page.context().storageState({ path: ESTADO_SESION(rol) });
  });
}
