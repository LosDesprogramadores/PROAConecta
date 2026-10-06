import { expect, test as base, type Browser, type BrowserContext, type Page } from '@playwright/test';

// Dummy values for the throwaway E2E stack. They must match docker-compose.e2e.yml (SEED_DEMO_PASSWORD).
export const DEMO_PASSWORD = process.env.E2E_PASSWORD ?? 'E2e-Demo-Pass-2026';
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:18025';

export type Rol = 'admin' | 'profesor' | 'estudiante';

// Accounts created by `manage.py seed_demo`. Pablo teaches Matemática; Emma is enrolled in it.
export const CUENTAS: Record<Rol, { dni: string; nombre: string; panel: RegExp; saludo: RegExp }> = {
  admin: { dni: '10000001', nombre: 'Ana Administradora', panel: /\/dashboard-admin/, saludo: /Administración de/ },
  profesor: { dni: '20000001', nombre: 'Pablo Profesor', panel: /\/dashboard\/welcome$/, saludo: /Hola, Pablo/ },
  estudiante: { dni: '30000003', nombre: 'Emma Estudiante', panel: /\/dashboard\/estudiante\/welcome$/, saludo: /Mis Materias/ },
};

export const ESTADO_SESION = (rol: Rol) => `.auth/${rol}.json`;

/** Fills the login form like a person would. It does not wait for the redirect. */
export async function completarLogin(page: Page, dni: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Tu Usuario').fill(dni);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

/** A browser context already logged in as the given role (session saved by auth.setup.ts). */
export async function contextoComo(browser: Browser, rol: Rol): Promise<BrowserContext> {
  return browser.newContext({ storageState: ESTADO_SESION(rol) });
}

/** Materia "Matemática" of the seed: opened through the UI, so the test does not depend on its numeric id. */
export async function abrirMateria(page: Page, titulo: string): Promise<void> {
  await page.goto('/dashboard/welcome');
  await page.getByRole('link', { name: new RegExp(`^${titulo}`) }).first().click();
  await expect(page).toHaveURL(/\/view-materia\/\d+\//);
}

interface MensajeMailpit {
  ID: string;
  Subject: string;
}

/** Waits for the message addressed to `destinatario` in Mailpit and returns its plain text body. */
export async function esperarCorreo(
  request: import('@playwright/test').APIRequestContext,
  destinatario: string,
): Promise<{ asunto: string; texto: string }> {
  let encontrado: MensajeMailpit | undefined;
  // The backend sends the mail from a background thread: poll instead of sleeping
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT_URL}/api/v1/search`, { params: { query: `to:${destinatario}` } });
        const cuerpo = (await res.json()) as { messages: MensajeMailpit[] };
        encontrado = cuerpo.messages[0];
        return encontrado !== undefined;
      },
      { message: `no email for ${destinatario} reached Mailpit`, timeout: 20_000 },
    )
    .toBe(true);
  const detalle = await request.get(`${MAILPIT_URL}/api/v1/message/${encontrado!.ID}`);
  const mensaje = (await detalle.json()) as { Subject: string; Text: string };
  return { asunto: mensaje.Subject, texto: mensaje.Text };
}

export const test = base;
export { expect };
