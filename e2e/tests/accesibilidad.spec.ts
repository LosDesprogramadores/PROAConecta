import { test, expect, type Page } from '../fixtures';
import { ESTADO_SESION } from '../fixtures';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Función auxiliar para ejecutar axe-core bajo WCAG 2.2 AA,
 * exportar el reporte JSON como evidencia y filtrar violaciones graves.
 */
async function auditarPantallaWCAG(page: Page, nombrePantalla: string) {
  const resultados = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  // Filtrar violaciones de impacto 'critical' o 'serious' según requerimiento de cátedra
  const violacionesGraves = resultados.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  // Generar carpeta de reportes localmente como evidencia del Entregable 5
  const dirReportes = path.join(process.cwd(), 'reportes-axe');
  if (!fs.existsSync(dirReportes)) {
    fs.mkdirSync(dirReportes, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(dirReportes, `axe-${nombrePantalla}.json`),
    JSON.stringify(
      {
        pantalla: nombrePantalla,
        url: page.url(),
        timestamp: new Date().toISOString(),
        totalViolaciones: resultados.violations.length,
        violacionesCriticasOSerias: violacionesGraves.length,
        detalleViolaciones: resultados.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          tags: v.tags.filter((t) => t.startsWith('wcag')),
          nodosAfectados: v.nodes.map((n) => ({
            html: n.html,
            target: n.target,
            failureSummary: n.failureSummary,
          })),
        })),
      },
      null,
      2
    )
  );

  if (violacionesGraves.length > 0) {
    console.log(`\n[ACC] Violaciones graves detectadas en [${nombrePantalla}]:`, 
      violacionesGraves.map(v => `${v.id} (${v.impact})`).join(', ')
    );
  }

  return violacionesGraves;
}

test.describe('Evaluación de Accesibilidad WCAG 2.2 Nivel AA (ACC)', () => {

  test.describe('Pantallas con sesión de Administrador', () => {
    test.use({ storageState: ESTADO_SESION('admin') });

    test('ACC-01: Dashboard Admin / Gestión de Materias', async ({ page }) => {
      await page.goto('/dashboard-admin');
      await page.getByRole('link', { name: 'Materias', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Gestión de Materias' })).toBeVisible();

      const violaciones = await auditarPantallaWCAG(page, 'admin-materias-listado');
      expect(violaciones, `Violaciones critical/serious en Materias: ${JSON.stringify(violaciones.map(v => v.id))}`).toEqual([]);
    });

    test('ACC-02: Modal de Nueva Materia (Formulario)', async ({ page }) => {
      await page.goto('/dashboard-admin');
      await page.getByRole('link', { name: 'Materias', exact: true }).click();
      await page.getByRole('button', { name: 'Nueva Materia' }).click();
      await expect(page.getByLabel('Título de la materia *')).toBeVisible();

      const violaciones = await auditarPantallaWCAG(page, 'admin-materia-modal-alta');
      expect(violaciones).toEqual([]);
    });
  });

  test.describe('Pantallas con sesión de Estudiante', () => {
    test.use({ storageState: ESTADO_SESION('estudiante') });

    test('ACC-03: Panel de Bienvenida Estudiante', async ({ page }) => {
      await page.goto('/dashboard/estudiante/welcome');
      await expect(page.getByRole('heading', { name: 'Mis Materias' })).toBeVisible();

      const violaciones = await auditarPantallaWCAG(page, 'estudiante-welcome');
      expect(violaciones).toEqual([]);
    });
  });

});