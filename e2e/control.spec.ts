import AxeBuilder from '@axe-core/playwright';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { FIXTURE, abrirConLibro, irA, vigilar } from './ayudas';

const CONTROL = resolve('fixtures/control-sintetico.xlsx');

test('Control seguimiento AMS: filtro, gráfica, columna, alerta e informe por tecnología', async ({ page }) => {
  const v = vigilar(page);
  await abrirConLibro(page, FIXTURE);

  // Sin Control no hay nada de tecnología
  await expect(page.getByRole('heading', { name: 'Horas por tecnología' })).toHaveCount(0);
  await expect(page.getByText('Tecnología', { exact: false }).first()).toBeHidden().catch(() => undefined);

  await irA(page, 'Configuración');
  await page.locator('input[aria-label="Archivo Control seguimiento AMS"]').setInputFiles(CONTROL);
  await expect(page.getByText(/casos con tecnología/).first()).toBeVisible();
  await expect(page.getByText(/aparecen con más de una tecnología/)).toBeVisible();

  await irA(page, 'Tablero');
  await expect(page.getByRole('heading', { name: 'Horas por tecnología' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Tecnología/ })).toBeVisible();
  await page.locator('summary', { hasText: 'Tecnología:' }).click();
  await page.getByRole('checkbox', { name: 'HCM' }).check();
  const filas = await page.locator('table').last().locator('tbody tr').allInnerTexts();
  expect(filas.length).toBeGreaterThan(0);
  expect(filas.every((f) => f.includes('HCM'))).toBe(true);

  await irA(page, 'Registros a revisar');
  await expect(page.getByRole('button', { name: /Sin tecnología/ })).toBeVisible();

  await irA(page, 'Informe para cliente');
  await page.getByLabel('Tecnología', { exact: true }).selectOption('HCM');
  await expect(page.locator('iframe[title="Vista previa del informe"]')).toBeVisible({ timeout: 20_000 });
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar PDF' }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^Informe_horas_.+_HCM_\d{4}-\d{2}-\d{2}_al_/);

  await page.getByLabel('Tecnología', { exact: true }).selectOption('');
  await page.getByLabel('En el .zip, un PDF por cada cliente y tecnología').check();
  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Generar para todos los clientes' }).click()]);
  expect(zip.suggestedFilename()).toMatch(/\.zip$/);

  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(r.violations.map((x) => x.id)).toEqual([]);
  expect(v.errores).toEqual([]);
  expect(v.peticiones).toEqual([]);
});

test('Control inválido: mensaje claro y la bitácora sigue funcionando', async ({ page }) => {
  await abrirConLibro(page, FIXTURE);
  await irA(page, 'Configuración');
  await page.locator('input[aria-label="Archivo Control seguimiento AMS"]').setInputFiles(FIXTURE);
  await expect(page.getByRole('alert').filter({ hasText: /Servicio\/Tecnología/ }).first()).toBeVisible();
  await irA(page, 'Tablero');
  await expect(page.getByRole('heading', { name: 'Horas por tecnología' })).toHaveCount(0);
});
