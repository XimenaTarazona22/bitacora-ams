import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import * as XLSX from 'xlsx';
import { HTML, irA, vigilar } from './ayudas';

XLSX.set_fs(fs);

const HOJAS = 40;
const FILAS = 3000;
const CLIENTES = ['ACH', 'Davivienda HCM', 'Davivienda ERP', 'SDS', 'U. Alberto H', 'Fiduprevisora'];
const TIPOS = ['Mesa Ayuda', 'Evolutivo', 'Preventa', 'Proyecto Implementación'];
const ESTADOS = ['M - Solucionado', 'E - Construcción', 'M - Pendiente Cliente', ''];
const ENC = ['Fecha', 'Cliente', 'Consultor', 'Tipo', 'Caso', 'Título del Caso', 'Consultor de Apoyo', 'Estado', 'Hora Inicio', 'Hora Fin', 'Tiempo Invertido', 'Clasificación Hora', 'Contrato Anterior', 'Actividades Realizadas'];

function libroGrande(ruta: string) {
  const libro = XLSX.utils.book_new();
  for (let h = 0; h < HOJAS; h++) {
    const filas: unknown[][] = [ENC];
    for (let i = 0; i < FILAS; i++) {
      const dia = 46000 + Math.floor(i / 12); // ~250 días, 12 registros por día y consultor
      const ini = (8 + (i % 6)) / 24;
      filas.push([
        dia, CLIENTES[(h + i) % CLIENTES.length], `Consultor ${h + 1}`, TIPOS[i % TIPOS.length],
        i % 17 === 0 ? 'SIN CASO' : `TASK${String(50000 + ((h * 7 + i) % 400)).padStart(7, '0')}`,
        `Título del caso número ${i % 400}`, null, ESTADOS[i % ESTADOS.length], ini, ini + 1 / 24, 1, 'Hora Normal', null,
        `Actividad realizada ${i}: se revisa el requerimiento y se documentan los hallazgos del análisis.`,
      ]);
    }
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), `Consultor ${h + 1}`.slice(0, 31));
  }
  XLSX.writeFile(libro, ruta);
}

test('@lento 40 hojas × 3.000 filas: carga en menos de ~5 s y la interfaz no se congela', async ({ page }) => {
  test.setTimeout(240_000);
  const ruta = join(tmpdir(), 'bitacora-rendimiento.xlsx');
  libroGrande(ruta);
  const v = vigilar(page);

  await page.goto(HTML);
  // Mide la congelación del hilo principal: un temporizador de 50 ms que registra el mayor retraso.
  await page.evaluate(() => {
    const w = window as unknown as { __maxRetraso: number };
    w.__maxRetraso = 0;
    let t = performance.now();
    setInterval(() => { const n = performance.now(); w.__maxRetraso = Math.max(w.__maxRetraso, n - t - 50); t = n; }, 50);
  });

  const t0 = Date.now();
  await page.locator('input[type=file]').setInputFiles(ruta);
  await expect(page.getByRole('heading', { name: /Tablero (semanal|diario)/ })).toBeVisible({ timeout: 60_000 });
  const segundos = (Date.now() - t0) / 1000;
  const retraso = await page.evaluate(() => (window as unknown as { __maxRetraso: number }).__maxRetraso);
  const tamanoMB = (fs.statSync(ruta).size / 1024 / 1024).toFixed(1);

  const t1 = Date.now();
  await irA(page, 'Registros a revisar');
  await expect(page.getByRole('button', { name: 'Copiar lista por consultor' })).toBeVisible();
  const segRevisar = (Date.now() - t1) / 1000;

  console.log(`RENDIMIENTO libro ${tamanoMB} MB · carga ${segundos.toFixed(1)} s · mayor congelación ${Math.round(retraso)} ms · cambio a «Registros a revisar» ${segRevisar.toFixed(1)} s`);
  fs.rmSync(ruta, { force: true });

  expect(segundos, 'carga total').toBeLessThan(5);
  expect(retraso, 'congelación del hilo principal (ms)').toBeLessThan(1000);
  expect(v.errores).toEqual([]);
});
