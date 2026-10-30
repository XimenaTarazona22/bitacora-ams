import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Page, expect } from '@playwright/test';

export const HTML = pathToFileURL(resolve('dist/BitacoraAMS.html')).href;
export const FIXTURE = resolve('fixtures/bitacora-sintetica.xlsx');

export const VISTAS = ['Tablero', 'Buscar caso', 'Informe para cliente', 'Registros a revisar', 'Configuración'] as const;

/** Registra errores de consola y toda petición que no sea local (file, blob, data). */
export function vigilar(page: Page) {
  const errores: string[] = [];
  const peticiones: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('request', (r) => {
    if (!/^(file|blob|data|about):/.test(r.url())) peticiones.push(r.url());
  });
  return { errores, peticiones };
}

/** Abre la app desde file:// y carga un libro como lo haría el arrastrar y soltar. */
export async function abrirConLibro(page: Page, libro = FIXTURE) {
  await page.goto(HTML);
  await page.locator('input[type=file]').setInputFiles(libro);
  await expect(page.getByRole('heading', { name: /Tablero (semanal|diario)/ })).toBeVisible({ timeout: 30_000 });
}

export const irA = (page: Page, vista: (typeof VISTAS)[number]) =>
  page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: vista }).click();
