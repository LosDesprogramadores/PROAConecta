import { expect, test, completarLogin } from '../fixtures';

// Per-account limit (login_dni) of the E2E stack (10/hour in production). The value comes from the same variable
// that docker-compose.e2e.yml passes to the backend (settings_e2e.py), so they cannot drift apart.
const LIMITE_POR_CUENTA = Number(process.env.E2E_LIMITE_INTENTOS_CUENTA ?? 30);

test('login lockout: after repeated failed attempts the form shows the "demasiados intentos" message', async ({
  page,
  request,
}) => {
  // A DNI that does not exist and is new on every run, so a rerun on the same stack starts from zero
  const dni = `8${Date.now().toString().slice(-7)}`;
  // Built at runtime: a literal password in a test file would be a secret-scanner false positive
  const claveIncorrecta = ['mala', Date.now(), 'x'].join('-');

  for (let intento = 1; intento <= LIMITE_POR_CUENTA; intento++) {
    const res = await request.post('/api/auth/login/', { data: { dni, password: claveIncorrecta } });
    expect(res.status(), `attempt ${intento} must be a plain credentials error`).toBe(400);
  }

  await completarLogin(page, dni, claveIncorrecta);

  await expect(page.getByText(/demasiados intentos/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
