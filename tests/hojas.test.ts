import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { FILAS_MAXIMAS, leerLibro } from '../src/dominio/leerLibro';
import { filaARegistro, mapearColumnas } from '../src/dominio/normalizar';

const ENC = ['Fecha', 'Cliente', 'Consultor', 'Tipo', 'Caso', 'Título del Caso', 'Consultor de Apoyo', 'Estado', 'Hora Inicio', 'Hora Fin', 'Tiempo Invertido', 'Clasificación Hora', 'Contrato Anterior', 'Actividades Realizadas'];
const mapa = mapearColumnas(ENC);
const fila = (...v: unknown[]) => [...v, ...Array(14 - v.length).fill(null)];

describe('filas sin usar', () => {
  it('cliente, consultor, tipo y clasificación prellenados con tiempo 0 no son un registro', () => {
    expect(filaARegistro(fila(null, 'ACH', 'Luis', 'Mesa Ayuda', 0, null, null, null, null, null, 0, 'Hora Normal'), mapa, 'H', 5)).toBeNull();
    expect(filaARegistro(fila(0, 'ACH', 'Luis', 'Mesa Ayuda', '0', '0', 0, 0, 0, 0, 0, 'Hora Normal', 'No', null), mapa, 'H', 5)).toBeNull();
    expect(filaARegistro(fila(), mapa, 'H', 5)).toBeNull();
  });
  it('una fila con datos pero sin fecha sí es un registro (alerta)', () => {
    expect(filaARegistro(fila(null, 'ACH', 'Luis', 'Mesa Ayuda', 'TASK1', 'Algo', null, null, null, null, 2), mapa, 'H', 5)?.fecha).toBeNull();
    expect(filaARegistro(fila(null, 'ACH', 'Luis', 'Mesa Ayuda', 0, null, null, null, null, null, 3), mapa, 'H', 5)?.horas).toBe(3);
    expect(filaARegistro(fila(null, 'ACH', 'Luis', null, 'SIN CASO'), mapa, 'H', 5)).not.toBeNull();
  });
});

describe('hoja consolidada y fixture', () => {
  const r = leerLibro(new Uint8Array(readFileSync('fixtures/bitacora-sintetica.xlsx')));
  it('no lee «Base de Datos» (duplicaría las horas) y lo informa', () => {
    expect(r.hojasExcluidas).toEqual(['Base de Datos']);
    expect(r.hojasConsultor).toEqual(['Ana P', 'Luis M']);
    expect(r.registros.some((x) => x.hoja === 'Base de Datos')).toBe(false);
  });
  it('cuenta los registros de cada hoja y descarta las filas sin usar', () => {
    expect(r.hojas).toEqual([{ nombre: 'Ana P', registros: 10 }, { nombre: 'Luis M', registros: 4 }]);
    expect(r.hojasTruncadas).toEqual([]);
  });
  it('se puede excluir otra hoja', () => {
    const r2 = leerLibro(new Uint8Array(readFileSync('fixtures/bitacora-sintetica.xlsx')), ['Base de Datos', 'Luis M']);
    expect(r2.hojasConsultor).toEqual(['Ana P']);
    expect([...r2.hojasExcluidas].sort()).toEqual(['Base de Datos', 'Luis M']);
  });
});

describe('hojas con fórmulas hasta el final de la hoja', () => {
  function libro(realesAl: number[], filas = FILAS_MAXIMAS + 5000): Uint8Array {
    const aoa: unknown[][] = [ENC];
    for (let i = 2; i <= filas; i++) {
      aoa.push(realesAl.includes(i)
        ? [46237, 'ACH', 'Ana', 'Mesa Ayuda', 'TASK0000001', 'T', null, 'M - Proceso', 0.33, 0.5, 4, 'Hora Normal', null, 'Algo']
        : [null, 'ACH', 'Ana', 'Mesa Ayuda', 0, null, null, null, null, null, 0, 'Hora Normal', null, null]);
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Ana P');
    return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  }

  it('lee los registros reales y salta el relleno sin avisar de falta de datos', () => {
    const r = leerLibro(libro([2, 10, 300]));
    expect(r.registros.map((x) => x.fila)).toEqual([2, 10, 300]);
    expect(r.hojasTruncadas).toEqual([]);
  });
  it('avisa si hay registros reales cerca del límite de filas', () => {
    const r = leerLibro(libro([2, FILAS_MAXIMAS - 10]));
    expect(r.hojasTruncadas).toEqual(['Ana P']);
  });
}, 60_000);

const completa = 'muestras/Bitácora completa.xlsx';
describe.skipIf(!existsSync(completa))('bitácora real completa (22 consultores, hoja consolidada y filas fantasma)', () => {
  const t0 = Date.now();
  const r = existsSync(completa) ? leerLibro(new Uint8Array(readFileSync(completa))) : leerLibro(new Uint8Array(readFileSync("fixtures/bitacora-sintetica.xlsx")));
  const segundos = (Date.now() - t0) / 1000;

  it('lee solo las hojas de consultor y salta «Base de Datos»', () => {
    expect(r.hojasExcluidas).toEqual(['Base de Datos']);
    expect(r.hojasConsultor).toHaveLength(22);
    expect(r.hojasConsultor).toContain('David P');
  });
  it('no devuelve millones de filas fantasma', () => {
    expect(r.registros.length).toBeGreaterThan(2000);
    expect(r.registros.length).toBeLessThan(10_000);
    expect(r.hojas.find((h) => h.nombre === 'David P')!.registros).toBeLessThan(600);
    expect(r.hojasTruncadas).toEqual([]);
  });
  it('casi todos los registros traen fecha', () => {
    const sin = r.registros.filter((x) => x.fecha === null).length;
    expect(sin / r.registros.length).toBeLessThan(0.05);
  });
  it('carga en un tiempo razonable', () => {
    console.log(`COMPLETA ${r.registros.length} registros, ${r.hojasConsultor.length} hojas, ${segundos.toFixed(1)} s, sin fecha ${r.registros.filter((x) => x.fecha === null).length}`);
    expect(segundos).toBeLessThan(40);
  });
}, 120_000);
