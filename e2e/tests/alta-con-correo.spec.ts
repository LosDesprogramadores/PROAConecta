import { completarLogin, contextoComo, esperarCorreo, expect, test } from '../fixtures';

// Closes the pending item of issue #265: account creation -> provisional password by email (Mailpit) ->
// first login -> forced, one-time password change.
test('admin creates a student: the temporary password arrives by email and forces the first password change', async ({
  browser,
  request,
}) => {
  const sufijo = Date.now().toString().slice(-7);
  const dni = `7${sufijo}`;
  const email = `e2e-${sufijo}@proa-e2e.test`;
  const nuevaClave = `Nueva-Clave-${sufijo}`;

  // 1. The administrator registers the student with an email
  const admin = await contextoComo(browser, 'admin');
  const paginaAdmin = await admin.newPage();
  await paginaAdmin.goto('/dashboard-admin/estudiantes');
  await paginaAdmin.getByRole('button', { name: 'Nuevo Estudiante' }).click();
  const formulario = paginaAdmin.getByRole('dialog', { name: 'Registrar Nuevo Estudiante' });
  await formulario.getByLabel('Nombre').fill('Nadia');
  await formulario.getByLabel('Apellido').fill(`Alta${sufijo}`);
  await formulario.getByLabel('DNI').fill(dni);
  await formulario.getByLabel('Fecha de Nacimiento').fill('2010-05-20');
  await formulario.getByLabel('Email').fill(email);
  await formulario.getByRole('button', { name: 'Guardar' }).click();
  await expect(paginaAdmin.getByText(/se creó con éxito/).first()).toBeVisible();
  await admin.close();

  // 2. The provisional password arrives in Mailpit
  const correo = await esperarCorreo(request, email);
  expect(correo.asunto).toContain('Credenciales de acceso');
  expect(correo.texto).toContain(dni);
  const clave = /Contraseña provisoria:\s*(\S+)/.exec(correo.texto)?.[1];
  expect(clave, 'the email must carry the provisional password').toBeTruthy();

  // 3. First login with DNI + provisional password goes to the forced change
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  await completarLogin(page, dni, clave!);
  await expect(page).toHaveURL(/\/cambiar-password$/);
  await expect(page.getByRole('heading', { name: 'Primer ingreso' })).toBeVisible();

  // 4. After the change the user lands on the student panel
  await page.getByLabel('Contraseña provisoria').fill(clave!);
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(nuevaClave);
  await page.getByLabel('Confirmar nueva contraseña').fill(nuevaClave);
  await page.getByRole('button', { name: 'Establecer contraseña' }).click();
  await expect(page).toHaveURL(/\/dashboard\/estudiante\/welcome$/);

  // 5. The change is one-time: the provisional password no longer works, the new one does
  const viejo = await request.post('/api/auth/login/', { data: { dni, password: clave } });
  expect(viejo.status()).toBe(400);
  const nuevo = await request.post('/api/auth/login/', { data: { dni, password: nuevaClave } });
  expect(nuevo.status()).toBe(200);
  await contexto.close();
});
