import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buscarCasos, casosRelacionados, fichaCaso, registrosDelCaso } from '../src/dominio/casos';
import { CONFIG_DEFECTO } from '../src/dominio/config';
import { leerLibro } from '../src/dominio/leerLibro';
import type { Periodo } from '../src/dominio/periodos';
import { actividadesUnicas, limpiarActividad, resumenPorEstado, textoRepresentativo } from '../src/dominio/resumenActividades';

// Sin la copia real (p. ej. en CI) devuelve vacío: los bloques que la usan se saltan, pero su cuerpo se evalúa igual.
const cargar = (ruta: string) => (existsSync(ruta) ? leerLibro(new Uint8Array(readFileSync(ruta))).registros : []);
const SEMANA: Periodo = { modo: 'semana', ancla: '2026-10-21' };

describe('limpiarActividad', () => {
  it('quita saludos, despedidas y firmas', () => {
    expect(limpiarActividad('Buenas tardes,\nSe revisa el proceso.\nSe ajusta el modelo.\nQuedo atento.\nSaludos\nAna Perez')).toBe(
      'Se revisa el proceso. Se ajusta el modelo.',
    );
  });
  it('corta el hilo de correo reenviado', () => {
    expect(limpiarActividad('Se analiza el error.\nDe: Juan <j@x.com>\nEnviado el: lunes\nTexto viejo')).toBe('Se analiza el error.');
  });
  it('deja intacto un texto sin ruido', () => expect(limpiarActividad('  Reunión de seguimiento  ')).toBe('Reunión de seguimiento'));
});

describe('resumen', () => {
  const regs = cargar('fixtures/bitacora-sintetica.xlsx');
  it('actividades únicas sin duplicados', () => {
    const rs = registrosDelCaso(regs, 'DAV-EVO-028').map((r) => ({ ...r, actividades: 'Franja 1.' }));
    expect(actividadesUnicas(rs)).toEqual(['Franja 1.']);
  });
  it('recorta en límite de palabra', () => {
    const t = textoRepresentativo(['palabra '.repeat(100).trim()], 50);
    expect(t.length).toBeLessThanOrEqual(51);
    expect(t.endsWith('…')).toBe(true);
  });
  it('agrupa por estado en orden cronológico', () => {
    const r = resumenPorEstado(registrosDelCaso(regs, 'PRB0043331'));
    expect(r.map((x) => x.estado)).toEqual(['M - Solucionado', 'M - Proceso']);
    expect(r.map((x) => x.horas)).toEqual([2, 1.5]);
  });
});

describe('búsqueda y ficha (fixture)', () => {
  const regs = cargar('fixtures/bitacora-sintetica.xlsx');
  it('busca por código, por parte del código y por título', () => {
    expect(buscarCasos(regs, CONFIG_DEFECTO, 'task0050017')[0]).toMatchObject({ caso: 'TASK0050017', horas: 8.5 });
    expect(buscarCasos(regs, CONFIG_DEFECTO, '0050017').map((s) => s.caso)).toContain('TASK0050017');
    expect(buscarCasos(regs, CONFIG_DEFECTO, 'titulo e')[0]?.caso).toBe('DAV-EVO-028');
    expect(buscarCasos(regs, CONFIG_DEFECTO, 'sincaso')).toEqual([]);
    expect(buscarCasos(regs, CONFIG_DEFECTO, '')).toEqual([]);
  });
  it('detecta casos relacionados en ambos sentidos', () => {
    expect(casosRelacionados(regs, 'PRB0043331').map((c) => c.caso)).toEqual(['TASK0050017']);
    expect(casosRelacionados(regs, 'TASK0050017').map((c) => c.caso)).toEqual(['PRB0043331']);
    expect(casosRelacionados(regs, '3732')).toEqual([]);
  });
  it('ficha con semanas', () => {
    const f = fichaCaso(registrosDelCaso(regs, 'TASK0050017'), SEMANA)!;
    expect(f).toMatchObject({ horas: 8.5, registros: 2, horasSemana: 8.5, estado: 'M - Solucionado', consultores: ['Ana Perez'] });
    expect(f.semanas).toEqual([{ lunes: '2026-10-19', horas: 8.5, finDeSemana: 0 }]);
  });
  it('ficha vacía', () => expect(fichaCaso([], SEMANA)).toBeNull());
});

const real = 'muestras/Bitácora Servicios AMS.xlsx';
describe.skipIf(!existsSync(real))('aceptación de la ficha con la copia real', () => {
  const regs = cargar(real);
  const f = fichaCaso(registrosDelCaso(regs, 'TASK0050017'), SEMANA)!;
  it('TASK0050017: periodo, semana y acumulado', () => {
    expect(f.primera).toBe('2026-08-24'); // el prompt dice 18 sep: las filas con espacio final empiezan antes
    expect(f.ultima).toBe('2026-10-27');
    expect(f.horasSemana).toBe(21);
    expect(f.horas).toBe(134.5); // 116,5 h del prompt + 18 h de las filas con espacio final
    expect(f.registros).toBe(43);
  });
  it('acumulado al 23 oct', () => {
    expect(f.acumuladoHastaSemana).toBe(117.5); // 99,5 h del prompt + 18 h de las filas con espacio final
  });
  it('la suma de semanas cuadra con el total', () => {
    expect(Math.round(f.semanas.reduce((s, x) => s + x.horas + x.finDeSemana, 0) * 100) / 100).toBe(f.horas);
  });
  it('encuentra el caso por el título y propone relacionados', () => {
    expect(buscarCasos(regs, CONFIG_DEFECTO, 'PRB0043331')[0]?.caso).toBe('PRB0043331');
    expect(casosRelacionados(regs, 'PRB0043331').length).toBeGreaterThanOrEqual(0);
  });
});
