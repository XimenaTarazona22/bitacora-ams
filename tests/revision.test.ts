import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filtrar } from '../src/dominio/agregaciones';
import { CONFIG_DEFECTO } from '../src/dominio/config';
import { leerLibro } from '../src/dominio/leerLibro';
import { rangoCompleto } from '../src/dominio/periodos';
import { evaluarAlertas, jornadasLargas } from '../src/dominio/reglas';
import { aplicarFiltros, conteosPorTipo, filasRevision, textoPorConsultor } from '../src/dominio/revision';

// Sin la copia real (p. ej. en CI) devuelve vacío: los bloques que la usan se saltan, pero su cuerpo se evalúa igual.
const cargar = (ruta: string) => (existsSync(ruta) ? leerLibro(new Uint8Array(readFileSync(ruta))).registros : []);
const armar = (regs: ReturnType<typeof cargar>, umbral = CONFIG_DEFECTO.jornadaLarga) =>
  filasRevision(regs, evaluarAlertas(regs, CONFIG_DEFECTO), jornadasLargas(regs, umbral));

describe('revisión (fixture)', () => {
  const regs = cargar('fixtures/bitacora-sintetica.xlsx');
  it('cuenta registros por tipo y jornadas largas por consultor-día', () => {
    const c = conteosPorTipo(armar(regs, 9));
    expect(c.sinCaso).toBe(4); // SinCaso, SIN CASO, vacío (sábado) y 0
    expect(c.franjaCruzada).toBe(2);
    expect(c.sinFecha).toBe(1);
    expect(c.jornadaLarga).toBe(1); // Ana Perez, 20 oct (9 h); el 19 suma 8,5
  });
  it('sin filtros omite los registros que solo tienen jornada larga', () => {
    const filas = armar(regs, 9);
    const ana20 = filas.filter((f) => f.registro.consultor === 'Ana Perez' && f.registro.fecha === '2026-10-20');
    expect(ana20.some((f) => f.tipos.includes('jornadaLarga'))).toBe(true);
    const sinFiltro = aplicarFiltros(filas, []);
    expect(sinFiltro.every((f) => f.tipos.some((t) => t !== 'jornadaLarga'))).toBe(true);
    expect(aplicarFiltros(filas, ['jornadaLarga']).length).toBe(ana20.length);
  });
  it('texto por consultor', () => {
    const t = textoPorConsultor(aplicarFiltros(armar(regs), ['franjaCruzada']), 'Lun 19 – Vie 23 oct 2026');
    expect(t).toMatch(/^Registros de la bitácora por revisar · Lun 19 – Vie 23 oct 2026/);
    expect(t).toContain('Luis Mora (2 registros)');
    expect(t).toContain('Hoja Luis M, fila 2');
    expect(t).toContain('por revisar: franja cruzada');
  });
});

const real = 'muestras/Bitácora Servicios AMS.xlsx';
describe.skipIf(!existsSync(real))('aceptación de revisión con la copia real', () => {
  const regs = cargar(real);
  const semana = filtrar(regs, { rango: rangoCompleto({ modo: 'semana', ancla: '2026-10-21' }), clientes: [], consultores: [], incluirFinDeSemana: true });
  const filas = armar(semana);
  it('7 sin caso lun–vie y 3 registros el sábado', () => {
    const c = conteosPorTipo(filas);
    expect(filas.filter((f) => f.tipos.includes('sinCaso') && f.registro.fecha! <= '2026-10-23')).toHaveLength(7);
    expect(c.finDeSemana).toBe(3);
    expect(c.casoNoReconocido).toBe(3);
  });
  it('registros a revisar: 13 (10 hábiles + 3 fin de semana)', () => {
    expect(aplicarFiltros(filas, [])).toHaveLength(13);
  });
});
