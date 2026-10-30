import { test } from '@playwright/test';
import { HTML, abrirConLibro, irA } from './ayudas';

// Capturas para el LEEME.md: siempre con el libro sintético, nunca con datos reales.
const DIR = 'docs/capturas';

test('@capturas pantallas del LEEME', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(HTML);
  await page.screenshot({ path: `${DIR}/01-conexion.png` });

  await abrirConLibro(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/02-tablero.png`, fullPage: true });

  await irA(page, 'Buscar caso');
  const caja = page.getByRole('combobox');
  await caja.fill('TASK0050017');
  await caja.press('Enter');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/03-buscar-caso.png`, fullPage: true });

  await irA(page, 'Registros a revisar');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/04-registros-a-revisar.png`, fullPage: true });

  await irA(page, 'Informe para cliente');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DIR}/05-informe.png` });

  await irA(page, 'Configuración');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/06-configuracion.png`, fullPage: true });
});
