import { contextoComo, expect, test, type Page } from '../fixtures';

// The three tests share one activity created by the first one: they run in order and retry together
test.describe.configure({ mode: 'serial' });

const titulo = `Actividad E2E ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

/** Local datetime-local value (YYYY-MM-DDTHH:mm) a week from now. */
function enUnaSemana(): string {
  const fecha = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

async function abrirMateriaDelEstudiante(page: Page): Promise<void> {
  await page.goto('/dashboard/estudiante/welcome');
  await page.getByRole('link', { name: /Matemática/ }).click();
  await expect(page).toHaveURL(/\/view-materia\/\d+\//);
}

const etiquetaPendientes = (n: number) => (n === 0 ? 'Sin pendientes' : n === 1 ? '1 Pendiente' : `${n} Pendientes`);

async function leerPendientes(page: Page): Promise<number> {
  await page.goto('/dashboard/estudiante/welcome');
  const tarjeta = page.getByText(/^\s*(\d+ Pendientes?|Sin pendientes)\s*$/);
  await expect(tarjeta).toBeVisible();
  const texto = (await tarjeta.textContent())!.replace(/\s+/g, ' ').trim();
  const n = texto === 'Sin pendientes' ? 0 : Number(texto.split(' ')[0]);
  // The label must follow the count (singular, plural and zero)
  expect(texto).toBe(etiquetaPendientes(n));
  return n;
}

test('a professor creates an activity from the materia', async ({ browser }) => {
  const contexto = await contextoComo(browser, 'profesor');
  const page = await contexto.newPage();

  await page.goto('/dashboard/welcome');
  await page.getByRole('link', { name: /^Matemática/ }).first().click();
  await expect(page).toHaveURL(/\/view-materia\/\d+\//);
  await page.getByRole('link', { name: 'Actividades' }).click();
  await page.getByRole('button', { name: 'Nueva actividad' }).click();

  await page.getByLabel('Título de la actividad *').fill(titulo);
  await page.getByLabel('Descripción / Consignas').fill('Actividad creada por la prueba end-to-end.');
  await page.getByLabel('Fecha y hora límite *').fill(enUnaSemana());
  await page.getByRole('button', { name: 'Crear Actividad' }).click();

  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
  await contexto.close();
});

test('a student sees the pending counter go down after delivering, and the navbar stays in Mensajes', async ({ browser }) => {
  const contexto = await contextoComo(browser, 'estudiante');
  const page = await contexto.newPage();

  const antes = await leerPendientes(page);
  expect(antes).toBeGreaterThanOrEqual(1);

  await abrirMateriaDelEstudiante(page);
  await page.getByRole('link', { name: 'Actividades' }).click();
  const tarjeta = page.getByRole('article').filter({ hasText: titulo });
  await tarjeta.getByRole('button', { name: 'Realizar entrega' }).click();
  await page.getByLabel(/Respuesta|Texto|Comentario/i).first().fill('Entrega de la prueba end-to-end.');
  await page.getByRole('button', { name: 'Confirmar Entrega' }).click();
  await page.getByRole('dialog').getByText('Cerrar', { exact: true }).click();
  await expect(tarjeta.getByRole('button', { name: 'Ver mi entrega' })).toBeVisible();

  // Back to the home through the logo: the counter dropped by one
  await page.getByTestId('logo-inicio').click();
  await expect(page).toHaveURL(/\/dashboard\/estudiante\/welcome$/);
  await expect(page.getByText(etiquetaPendientes(antes - 1), { exact: true })).toBeVisible();

  // The materia navbar is still there in Mensajes, and has no Material link (decision D1)
  await abrirMateriaDelEstudiante(page);
  await page.getByRole('link', { name: 'Mensajes', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/mensajes\?materia=\d+/);
  const secciones = page.getByTestId('nav-secciones-escritorio');
  for (const nombre of ['Portada', 'Anuncios', 'Actividades', 'Calificaciones', 'Mensajes']) {
    await expect(secciones.getByRole('link', { name: nombre })).toBeVisible();
  }
  await expect(secciones.getByRole('link', { name: 'Material' })).toHaveCount(0);
  await contexto.close();
});

test('a professor reviews the deliveries from the home cards and grades a student without delivery', async ({ browser }) => {
  const contexto = await contextoComo(browser, 'profesor');
  const page = await contexto.newPage();

  await page.goto('/dashboard/welcome');
  const tarjeta = page.getByRole('link', { name: /Entregas/ });
  await expect(tarjeta).toContainText(/\d+ por calificar/);
  await tarjeta.click();
  await expect(page).toHaveURL(/\/dashboard\/entregas$/);
  await expect(page.getByRole('button', { name: 'Sin calificar' })).toHaveAttribute('aria-pressed', 'true');

  const fila = page.getByTestId('fila-entrega').filter({ hasText: titulo });
  await expect(fila).toContainText('Emma');
  await fila.getByRole('link', { name: 'Ver entregas' }).click();

  // Every enrolled student is listed, with or without delivery
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
  const filas = page.getByTestId('fila-estudiante');
  await expect(filas).toHaveCount(4);
  await expect(filas.filter({ hasText: 'Emma' }).getByTestId('estado')).toHaveText('Entregado');
  const emilio = filas.filter({ hasText: 'Emilio' });
  await expect(emilio.getByTestId('estado')).toHaveText(/Pendiente|No entregado/);

  await emilio.getByRole('button', { name: 'Calificar' }).click();
  await page.getByLabel('Nota (1 a 10)').fill('8');
  await page.getByLabel('Comentario / devolución').fill('Calificación administrativa de la prueba.');
  await page.getByRole('button', { name: 'Guardar calificación' }).click();
  await expect(emilio.getByTestId('estado')).toHaveText('Corregido');

  // Leave the board clean for the next run: Emma's delivery is graded too
  const emma = filas.filter({ hasText: 'Emma' });
  await emma.getByRole('button', { name: 'Calificar' }).click();
  await page.getByLabel('Nota (1 a 10)').fill('9');
  await page.getByRole('button', { name: 'Guardar calificación' }).click();
  await expect(emma.getByTestId('estado')).toHaveText('Corregido');

  // The logo takes the professor home
  await page.getByTestId('logo-inicio').click();
  await expect(page).toHaveURL(/\/dashboard\/welcome$/);
  await contexto.close();
});
