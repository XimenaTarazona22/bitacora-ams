import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG_DEFECTO } from '../src/dominio/config';
import {
  clientesDelPeriodo, construirInforme, nombreArchivoInforme, nombreParaPdf, opcionesPorDefecto, separarCodigos, verificarInforme,
} from '../src/dominio/informe';
import { leerLibro } from '../src/dominio/leerLibro';
import { esSemanaLV, etiquetaLarga } from '../src/dominio/periodos';

const cargar = (ruta: string) => leerLibro(new Uint8Array(readFileSync(ruta))).registros;
const SEMANA = { desde: '2026-10-19', hasta: '2026-10-23' };
const EMITIDO = '2026-10-29';
const r2 = (n: number) => Math.round(n * 100) / 100;

describe('utilidades', () => {
  it('separa códigos pegados', () => {
    expect(separarCodigos('task0050017, PRB0043331\n 3732;  task0050017 ')).toEqual(['TASK0050017', 'PRB0043331', '3732']);
    expect(separarCodigos('  ')).toEqual([]);
  });
  it('nombres para el PDF', () => {
    expect(nombreParaPdf('Camilo Trujillo', 'inicial')).toBe('C. Trujillo');
    expect(nombreParaPdf('Camilo Trujillo', 'completo')).toBe('Camilo Trujillo');
    expect(nombreParaPdf('Madonna', 'inicial')).toBe('Madonna');
  });
  it('nombre de archivo sin caracteres inválidos', () => {
    expect(nombreArchivoInforme('U. Alberto H', SEMANA)).toBe('Informe_horas_U._Alberto_H_2026-10-19_al_2026-10-23.pdf');
    expect(nombreArchivoInforme('A/B: "C"?', SEMANA)).toBe('Informe_horas_AB_C_2026-10-19_al_2026-10-23.pdf');
  });
  it('periodo en texto completo', () => {
    expect(etiquetaLarga(SEMANA)).toBe('Lunes 19 – viernes 23 de octubre de 2026');
    expect(etiquetaLarga({ desde: '2026-10-22', hasta: '2026-10-22' })).toBe('Jueves 22 de octubre de 2026');
    expect(etiquetaLarga({ desde: '2026-09-28', hasta: '2026-10-02' })).toBe('Lunes 28 de septiembre – viernes 2 de octubre de 2026');
    expect(esSemanaLV(SEMANA)).toBe(true);
    expect(esSemanaLV({ desde: '2026-10-19', hasta: '2026-10-22' })).toBe(false);
  });
});

describe('informe (fixture)', () => {
  const regs = cargar('fixtures/bitacora-sintetica.xlsx');
  const o = opcionesPorDefecto('ACH', SEMANA, CONFIG_DEFECTO);
  const base = construirInforme(regs, CONFIG_DEFECTO, o, {}, EMITIDO);

  it('agrupa lo sin caso como Actividades generales y lo deja al final', () => {
    const ultima = base.filas[base.filas.length - 1]!;
    expect(ultima).toMatchObject({ caso: '—', descripcion: 'Actividades generales', horas: 4, acumulado: null, general: true });
    expect(base.casos).toBe(base.filas.length - 1);
  });
  it('excluye lo sin caso si se pide', () => {
    const i = construirInforme(regs, CONFIG_DEFECTO, { ...o, sinCaso: 'excluir' }, {}, EMITIDO);
    expect(i.filas.some((f) => f.general)).toBe(false);
  });
  it('solo los casos pedidos y avisa de los que no aparecen', () => {
    const i = construirInforme(regs, CONFIG_DEFECTO, { ...o, casos: 'solicitados', solicitados: ['TASK0050017', 'TASK9999999'] }, {}, EMITIDO);
    expect(i.filas.map((f) => f.caso)).toEqual(['TASK0050017']);
    expect(i.noEncontrados).toEqual(['TASK9999999']);
    expect(i.totalHoras).toBe(8.5);
  });
  it('usa el resumen editado en lugar del borrador', () => {
    const clave = `ACH|TASK0050017|${SEMANA.desde}|${SEMANA.hasta}`;
    const i = construirInforme(regs, CONFIG_DEFECTO, o, { [clave]: 'Texto editado' }, EMITIDO);
    const f = i.filas.find((x) => x.caso === 'TASK0050017')!;
    expect(f.resumen).toBe('Texto editado');
    expect(f.resumenBorrador).toMatch(/Se revisa el proceso/);
    expect(f.resumenBorrador).not.toMatch(/Saludos|Buenas tardes|Quedo atento/);
  });
  it('fin de semana y sin estado según la opción', () => {
    const sab = { ...o, rango: { desde: '2026-10-19', hasta: '2026-10-25' } };
    expect(construirInforme(regs, CONFIG_DEFECTO, sab, {}, EMITIDO).totalHoras).toBe(base.totalHoras);
    expect(construirInforme(regs, CONFIG_DEFECTO, { ...sab, finDeSemana: 'incluir' }, {}, EMITIDO).totalHoras).toBe(r2(base.totalHoras + 2));
    expect(verificarInforme(regs, CONFIG_DEFECTO, 'ACH', sab.rango)).toMatchObject({ horasFinDeSemana: 2, registrosFinDeSemana: 1 });
    expect(construirInforme(regs, CONFIG_DEFECTO, { ...o, sinEstado: 'excluir' }, {}, EMITIDO).totalHoras).toBeLessThan(base.totalHoras);
  });
  it('detalle por día cuadra con las horas de cada fila y del total', () => {
    base.filas.forEach((f, n) => expect(r2(base.detalle[n]!.reduce((a, b) => a + b, 0))).toBe(f.horas));
    expect(r2(base.horasPorDia.reduce((a, b) => a + b, 0))).toBe(base.totalHoras);
  });
  it('lista los clientes del periodo', () => {
    expect(clientesDelPeriodo(regs, SEMANA, false)).toEqual(['ACH', 'Davivienda ERP', 'Davivienda HCM', 'SDS']);
  });
});

const real = 'muestras/Bitácora Servicios AMS.xlsx';
describe.skipIf(!existsSync(real))('aceptación del informe con la copia real', () => {
  const regs = cargar(real);
  const i = construirInforme(regs, CONFIG_DEFECTO, opcionesPorDefecto('ACH', SEMANA, CONFIG_DEFECTO), {}, EMITIDO);
  const h = (c: string) => i.filas.find((f) => f.caso === c)?.horas;

  it('ACH esa semana: 56,5 h por caso', () => {
    expect(i.totalHoras).toBe(56.5);
    expect([h('TASK0050017'), h('PRB0043331'), h('TASK0050160'), h('TASK0050186'), h('TASK0050236')]).toEqual([21, 11.5, 7.5, 7.5, 2.5]);
    expect([h('TASK0050145'), h('TASK0050085'), h('Seguimiento ACH')]).toEqual([2, 1, 1]);
    expect(i.filas.find((f) => f.general)?.horas).toBe(2.5);
  });
  it('acumulado de TASK0050017 al 23 oct: 117,5 h', () => {
    expect(i.filas.find((f) => f.caso === 'TASK0050017')?.acumulado).toBe(117.5);
  });
  it('los 5 clientes de la semana', () => {
    expect(clientesDelPeriodo(regs, SEMANA, false)).toHaveLength(5);
  });
  it('resumen de TASK0050017 sin firmas y de máximo ~400 caracteres', () => {
    const f = i.filas.find((x) => x.caso === 'TASK0050017')!;
    expect(f.resumenBorrador.length).toBeLessThanOrEqual(401);
    expect(f.resumenBorrador).not.toMatch(/Saludos|Cordialmente/);
  });
});
