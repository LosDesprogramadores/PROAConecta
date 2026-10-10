import { ESTADO_SESION, expect, test, type Page } from '../fixtures';

const BLOQUEO = 'Esta materia tiene profesor o estudiantes, primero debe desasignarlos o desinscribirlos';

/** Each test creates its own materia through the UI, so none depends on what the others left behind. */
async function crearMateria(page: Page): Promise<string> {
  const titulo = `Materia E2E ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.goto('/dashboard-admin');
  await page.getByRole('link', { name: 'Materias', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gestión de Materias' })).toBeVisible();

  await page.getByRole('button', { name: 'Nueva Materia' }).click();
  await page.getByLabel('Título de la materia *').fill(titulo);
  await page.getByLabel('Curso *').fill('2do B');
  await page.getByLabel('Año Lectivo *').fill(String(new Date().getFullYear()));
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(fila(page, titulo)).toBeVisible();
  return titulo;
}

const fila = (page: Page, titulo: string) => page.getByRole('row', { name: new RegExp(titulo) });

async function asignarProfesor(page: Page, titulo: string, profesor: string): Promise<void> {
  await fila(page, titulo).getByRole('button', { name: 'Asignar' }).click();
  const modal = page.getByRole('dialog', { name: 'Asignar profesor titular' });
  await modal.getByRole('radio', { name: `Seleccionar ${profesor}` }).check();
  await modal.getByRole('button', { name: 'Confirmar asignación' }).click();
  await expect(page.getByText('Profesor asignado correctamente.')).toBeVisible();
  await expect(modal).toBeHidden();
}

async function quitarTitular(page: Page, titulo: string): Promise<void> {
  await fila(page, titulo).getByRole('button', { name: 'Asignar' }).click();
  const modal = page.getByRole('dialog', { name: 'Asignar profesor titular' });
  await modal.getByRole('button', { name: 'Quitar titular' }).click();
  await expect(page.getByText('Profesor desasignado correctamente.')).toBeVisible();
  await expect(modal).toBeHidden();
}

async function eliminar(page: Page, titulo: string): Promise<void> {
  await fila(page, titulo).getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('dialog', { name: 'Eliminar materia' }).getByRole('button', { name: 'Sí, eliminar' }).click();
}

test.describe('admin materias', () => {
  test.use({ storageState: ESTADO_SESION('admin') });

  test('Consultar shows the titular professor and the enrolled students of a materia', async ({ page }) => {
    await page.goto('/dashboard-admin');
    await page.getByRole('link', { name: 'Materias', exact: true }).click();

    // Seed data: Pablo teaches Matemática; Emma is enrolled in it (read-only check, nothing is changed)
    await page.getByRole('row', { name: /Matemática/ }).getByRole('button', { name: 'Consultar' }).click();
    const panel = page.getByTestId('panel-consulta');
    await expect(panel).toContainText('Matemática');
    await expect(panel).toContainText('Profesor, Pablo');
    await expect(panel.getByRole('row', { name: /Estudiante, Emma/ })).toBeVisible();

    await panel.getByRole('button', { name: 'Cerrar detalle' }).click();
    await expect(panel).toBeHidden();
  });

  test('deleting a materia with a professor is blocked and the row stays; after Quitar titular it is deleted', async ({ page }) => {
    const titulo = await crearMateria(page);
    await asignarProfesor(page, titulo, 'Profesora, Paula');

    await eliminar(page, titulo);
    await expect(page.getByText(BLOQUEO)).toBeVisible();
    await expect(fila(page, titulo)).toBeVisible();

    await quitarTitular(page, titulo);
    await eliminar(page, titulo);
    await expect(page.getByText('Materia eliminada correctamente.')).toBeVisible();
    await expect(fila(page, titulo)).toHaveCount(0);
  });

  test('a professor is assigned to a materia and then removed with Quitar titular', async ({ page }) => {
    const titulo = await crearMateria(page);

    await asignarProfesor(page, titulo, 'Profesora, Paula');
    await fila(page, titulo).getByRole('button', { name: 'Consultar' }).click();
    const panel = page.getByTestId('panel-consulta');
    await expect(panel).toContainText(titulo);
    await expect(panel).toContainText('Profesora, Paula');

    await quitarTitular(page, titulo);
    await expect(panel).toContainText('Sin profesor asignado.');

    // Cleanup: the materia is empty again, so it can be deleted
    await eliminar(page, titulo);
    await expect(fila(page, titulo)).toHaveCount(0);
  });

  test('two students are enrolled in bulk, show up in Consultar and stop being candidates', async ({ page }) => {
    const titulo = await crearMateria(page);

    await fila(page, titulo).getByRole('button', { name: 'Inscribir' }).click();
    const modal = page.getByRole('dialog', { name: 'Inscribir estudiantes' });
    await modal.getByLabel('Buscar estudiante').fill('Estudiante');
    await modal.getByRole('checkbox', { name: 'Seleccionar Estudiante, Eva' }).check();
    await modal.getByRole('checkbox', { name: 'Seleccionar Estudiante, Ezequiel' }).check();
    await expect(modal.getByTestId('contador-seleccionados')).toHaveText('2 seleccionados');
    await modal.getByRole('button', { name: 'Inscribir seleccionados' }).click();

    await expect(page.getByText('Se inscribió a 2 estudiantes.')).toBeVisible();
    await expect(modal).toBeHidden();

    await fila(page, titulo).getByRole('button', { name: 'Consultar' }).click();
    const panel = page.getByTestId('panel-consulta');
    await expect(panel.getByRole('row', { name: /Estudiante, Eva/ })).toBeVisible();
    await expect(panel.getByRole('row', { name: /Estudiante, Ezequiel/ })).toBeVisible();

    // Already enrolled students are no longer offered
    await fila(page, titulo).getByRole('button', { name: 'Inscribir' }).click();
    await page.getByLabel('Buscar estudiante').fill('Estudiante');
    await expect(page.getByRole('checkbox', { name: 'Seleccionar Estudiante, Elena' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Seleccionar Estudiante, Eva' })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Seleccionar Estudiante, Ezequiel' })).toHaveCount(0);
  });

  test('an empty materia can be deleted', async ({ page }) => {
    const titulo = await crearMateria(page);

    await eliminar(page, titulo);

    await expect(page.getByText('Materia eliminada correctamente.')).toBeVisible();
    await expect(fila(page, titulo)).toHaveCount(0);
  });
});
