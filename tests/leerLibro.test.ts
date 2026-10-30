import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leerLibro } from '../src/dominio/leerLibro';

// Sin la copia real (p. ej. en CI) devuelve vacío: el bloque se salta, pero su cuerpo se evalúa igual.
const leer = (ruta: string) => (existsSync(ruta) ? leerLibro(new Uint8Array(readFileSync(ruta))) : { ...leerLibro(new Uint8Array(readFileSync("fixtures/bitacora-sintetica.xlsx"))), registros: [] });

describe('fixture sintético', () => {
  const r = leer('fixtures/bitacora-sintetica.xlsx');

  it('detecta solo hojas de consultor', () => {
    expect(r.hojasConsultor).toEqual(['Ana P', 'Luis M']);
    expect(r.hojasIgnoradas).toContain('Xlat');
    expect(r.hojasIgnoradas).toContain('Horas por Consultor Todos');
  });
  it('omite filas vacías pero conserva las que no tienen fecha', () => {
    expect(r.registros).toHaveLength(14);
    expect(r.registros.filter((x) => x.fecha === null)).toHaveLength(1);
  });
  it('conserva hoja y fila de origen', () => {
    const x = r.registros.find((q) => q.caso === 'DAV-EVO-028');
    expect(x).toMatchObject({ hoja: 'Luis M', fila: 2 });
  });
  it('normaliza casos y redondea horas', () => {
    expect(r.registros.filter((x) => x.caso === 'PRB0043331')).toHaveLength(2);
    expect(r.registros.some((x) => x.caso === '3732')).toBe(true);
    expect(r.registros.filter((x) => x.caso === 'TASK0050017').reduce((s, x) => s + x.horas, 0)).toBe(8.5);
  });
  it('recalcula horas vacías e ignora HORAS TOTALES', () => {
    const calc = r.registros.find((x) => x.horasCalculadas);
    expect(calc?.horas).toBe(1.5);
    const luis = r.registros.filter((x) => x.hoja === 'Luis M').reduce((s, x) => s + x.horas, 0);
    expect(luis).toBe(8);
  });
  it('deja horas ≤ 0 visibles para las alertas', () => {
    expect(r.registros.some((x) => x.horas <= 0 && x.fecha)).toBe(true);
  });
});

// Prueba de aceptación: solo corre si la copia real está en muestras/.
const real = 'muestras/Bitácora Servicios AMS.xlsx';
describe.skipIf(!existsSync(real))('aceptación con la copia real', () => {
  const r = leer(real);
  const semana = r.registros.filter((x) => x.fecha !== null && x.fecha >= '2026-10-19' && x.fecha <= '2026-10-23');
  const por = (k: 'cliente' | 'consultor' | 'tipo', xs = semana) => {
    const m: Record<string, number> = {};
    for (const x of xs) m[x[k]] = redondear(( m[x[k]] ?? 0) + x.horas);
    return m;
  };
  const redondear = (n: number) => Math.round(n * 100) / 100;

  it('lee 2 hojas de consultor', () => expect(r.hojasConsultor).toEqual(['Camilo T', 'Edwin V']));
  it('totales de la semana', () => {
    expect(redondear(semana.reduce((s, x) => s + x.horas, 0))).toBe(92);
    expect(semana).toHaveLength(48);
    expect(new Set(semana.map((x) => x.caso)).size).toBe(20);
    expect(new Set(semana.map((x) => x.cliente)).size).toBe(5);
  });
  it('por cliente, consultor y tipo', () => {
    expect(por('cliente')).toEqual({ ACH: 56.5, 'Davivienda ERP': 20, 'Davivienda HCM': 8.5, 'U. Alberto H': 4, SDS: 3 });
    expect(por('consultor')).toEqual({ 'Camilo Trujillo': 49, 'Edwin Villamil': 43 });
    expect(por('tipo')).toEqual({ Evolutivo: 51.5, 'Mesa Ayuda': 28, Preventa: 9.5, 'Proyecto Implementación': 3 });
  });
  it('caso TASK0050017', () => {
    const c = r.registros.filter((x) => x.caso === 'TASK0050017');
    expect(c).toHaveLength(43); // 39 sin recortar espacios + 4 filas «TASK0050017 » (Edwin V, 39-44): ver CLAUDE.md
    expect(redondear(c.reduce((s, x) => s + x.horas, 0))).toBe(134.5);
  });
});
