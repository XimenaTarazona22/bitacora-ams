import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { VISTAS, abrirConLibro, irA, vigilar } from './ayudas';

test('abre desde file://, carga el libro, muestra el tablero y genera un PDF sin red ni errores', async ({ page }) => {
  const v = vigilar(page);
  await abrirConLibro(page);

  await expect(page.getByText('Horas registradas')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Casos de la semana/ })).toBeVisible();
  await expect(page.getByText(/2 hojas de consultor/)).toBeVisible();

  await irA(page, 'Informe para cliente');
  await expect(page.locator('iframe[title="Vista previa del informe"]')).toBeVisible({ timeout: 20_000 });
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar PDF' }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^Informe_horas_.+_\d{4}-\d{2}-\d{2}_al_\d{4}-\d{2}-\d{2}\.pdf$/);
  const ruta = await descarga.path();
  expect(readFileSync(ruta).subarray(0, 5).toString()).toBe('%PDF-');

  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Generar para todos los clientes' }).click()]);
  expect(zip.suggestedFilename()).toMatch(/^Informes_horas_.+\.zip$/);
  expect(readFileSync(await zip.path()).subarray(0, 2).toString()).toBe('PK');

  expect(v.errores, 'errores de consola').toEqual([]);
  expect(v.peticiones, 'peticiones de red').toEqual([]);
});

test('Buscar caso y Registros a revisar responden con el libro de prueba', async ({ page }) => {
  await abrirConLibro(page);
  await irA(page, 'Buscar caso');
  const caja = page.getByRole('combobox');
  await caja.fill('TASK0050017');
  await caja.press('Enter');
  await expect(page.getByText('Horas acumuladas')).toBeVisible();
  await expect(page.getByText(/Caso relacionado/)).toBeVisible();

  await irA(page, 'Registros a revisar');
  await expect(page.getByRole('button', { name: 'Copiar lista por consultor' })).toBeVisible();
});

test('accesibilidad: sin violaciones graves en ninguna sección', async ({ page }) => {
  await abrirConLibro(page);
  for (const vista of VISTAS) {
    await irA(page, vista);
    await page.waitForTimeout(400);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const graves = r.violations.map((x) => `${vista}: ${x.id} (${x.impact}) ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    expect(graves, vista).toEqual([]);
  }
});

test('responsivo: sin desbordamiento horizontal en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await abrirConLibro(page);
  for (const vista of VISTAS) {
    await irA(page, vista);
    await page.waitForTimeout(300);
    const [ancho, visible] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(ancho, `${vista}: ancho ${ancho} > ${visible}`).toBeLessThanOrEqual(visible + 1);
  }
});

test('Tablero por rango de fechas: agrupa por semana y respeta Desde ≤ Hasta', async ({ page }) => {
  await abrirConLibro(page);
  await page.getByRole('group', { name: 'Vista' }).getByRole('button', { name: 'Rango' }).click();
  const grupo = page.getByRole('group', { name: 'Rango de fechas' });
  await grupo.getByLabel('Desde').fill('2026-09-21');
  await grupo.getByLabel('Hasta').fill('2026-10-21');
  await expect(page.getByRole('heading', { name: 'Tablero por periodo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Horas por consultor y semana' })).toBeVisible();
  await grupo.getByLabel('Hasta').fill('2026-09-10');
  await expect(grupo.getByLabel('Desde')).toHaveValue('2026-09-10');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(r.violations.map((x) => x.id)).toEqual([]);
});
