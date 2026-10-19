# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login-bloqueo.spec.ts >> login lockout: after repeated failed attempts the form shows the "demasiados intentos" message
- Location: tests/login-bloqueo.spec.ts:7:5

# Error details

```
Error: attempt 2 must be a plain credentials error

expect(received).toBe(expected) // Object.is equality

Expected: 400
Received: 429
```

# Test source

```ts
  1  | import { expect, test, completarLogin } from '../fixtures';
  2  | 
  3  | // Per-account limit (login_dni) of the E2E stack (10/hour in production). The value comes from the same variable
  4  | // that docker-compose.e2e.yml passes to the backend (settings_e2e.py), so they cannot drift apart.
  5  | const LIMITE_POR_CUENTA = Number(process.env.E2E_LIMITE_INTENTOS_CUENTA ?? 30);
  6  | 
  7  | test('login lockout: after repeated failed attempts the form shows the "demasiados intentos" message', async ({
  8  |   page,
  9  |   request,
  10 | }) => {
  11 |   // A DNI that does not exist and is new on every run, so a rerun on the same stack starts from zero
  12 |   const dni = `8${Date.now().toString().slice(-7)}`;
  13 |   // Built at runtime: a literal password in a test file would be a secret-scanner false positive
  14 |   const claveIncorrecta = ['mala', Date.now(), 'x'].join('-');
  15 | 
  16 |   for (let intento = 1; intento <= LIMITE_POR_CUENTA; intento++) {
  17 |     const res = await request.post('/api/auth/login/', { data: { dni, password: claveIncorrecta } });
> 18 |     expect(res.status(), `attempt ${intento} must be a plain credentials error`).toBe(400);
     |                                                                                  ^ Error: attempt 2 must be a plain credentials error
  19 |   }
  20 | 
  21 |   await completarLogin(page, dni, claveIncorrecta);
  22 | 
  23 |   await expect(page.getByText(/demasiados intentos/i)).toBeVisible();
  24 |   await expect(page).toHaveURL(/\/login$/);
  25 | });
  26 | 
```