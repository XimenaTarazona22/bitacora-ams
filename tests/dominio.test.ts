import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { casosDelPeriodo, filtrar, horasFinDeSemana, indicadores, mapaCalor, sumarPor } from '../src/dominio/agregaciones';
import { CONFIG_DEFECTO } from '../src/dominio/config';
import { estadoSinPrefijo, formatearHoras } from '../src/dominio/formato';
import { leerLibro } from '../src/dominio/leerLibro';
import {
  diasDelRango, etiquetaSemana, moverPeriodo, periodoInicial, rangoCompleto, rangoPeriodo, semanaLV,
} from '../src/dominio/periodos';
import { evaluarAlertas, jornadasLargas, resumenRevision } from '../src/dominio/reglas';

const cargar = (ruta: string) => leerLibro(new Uint8Array(readFileSync(ruta))).registros;
const SEMANA = semanaLV('2026-10-21');

describe('periodos', () => {
  it('semana lun–vie y etiquetas', () => {
    expect(SEMANA).toEqual({ desde: '2026-10-19', hasta: '2026-10-23' });
    expect(etiquetaSemana(SEMANA)).toBe('Lun 19 – Vie 23 oct 2026');
    expect(etiquetaSemana(semanaLV('2026-09-30'))).toBe('Lun 28 sep – Vie 2 oct 2026');
    expect(etiquetaSemana(semanaLV('2026-12-31'))).toBe('Lun 28 dic 2026 – Vie 1 ene 2027');
  });
  it('rango completo llega al domingo', () => {
    expect(rangoCompleto({ modo: 'semana', ancla: '2026-10-21' }).hasta).toBe('2026-10-25');
    expect(rangoPeriodo({ modo: 'dia', ancla: '2026-10-21' })).toEqual({ desde: '2026-10-21', hasta: '2026-10-21' });
  });
  it('navega por semana y por día hábil', () => {
    expect(moverPeriodo({ modo: 'semana', ancla: '2026-10-21' }, 1).ancla).toBe('2026-10-28');
    expect(moverPeriodo({ modo: 'dia', ancla: '2026-10-23' }, 1).ancla).toBe('2026-10-26');
    expect(moverPeriodo({ modo: 'dia', ancla: '2026-10-26' }, -1).ancla).toBe('2026-10-23');
  });
  it('días del rango sin fin de semana', () => {
    expect(diasDelRango({ desde: '2026-10-19', hasta: '2026-10-25' })).toHaveLength(5);
    expect(diasDelRango({ desde: '2026-10-19', hasta: '2026-10-25' }, true)).toHaveLength(7);
  });
  it('periodo inicial', () => {
    expect(periodoInicial(['2026-10-20'], '2026-10-22').ancla).toBe('2026-10-22');
    expect(periodoInicial(['2026-08-03', '2026-09-01'], '2026-10-22').ancla).toBe('2026-09-01');
    expect(periodoInicial([], '2026-10-22').ancla).toBe('2026-10-22');
  });
});

describe('formato', () => {
  it('horas decimales y h:mm', () => {
    expect(formatearHoras(7.5)).toBe('7,5 h');
    expect(formatearHoras(7.5, 'hm')).toBe('7:30');
    expect(formatearHoras(8, 'hm')).toBe('8:00');
  });
  it('estado sin prefijo', () => expect(estadoSinPrefijo('M - Solucionado')).toBe('Solucionado'));
});

describe('fixture sintético', () => {
  const regs = cargar('fixtures/bitacora-sintetica.xlsx');
  const f = { rango: SEMANA, clientes: [], consultores: [], incluirFinDeSemana: false };

  it('filtra por periodo, cliente y fin de semana', () => {
    const s = filtrar(regs, f);
    expect(s.every((r) => r.fecha! >= SEMANA.desde && r.fecha! <= SEMANA.hasta)).toBe(true);
    expect(filtrar(regs, { ...f, clientes: ['SDS'] })).toHaveLength(1);
    expect(filtrar(regs, { ...f, rango: rangoCompleto({ modo: 'semana', ancla: '2026-10-21' }), incluirFinDeSemana: true })).toHaveLength(s.length + 1);
  });
  it('nota de horas fuera de lun–vie', () => {
    expect(horasFinDeSemana(regs, { ...f, rango: rangoCompleto({ modo: 'semana', ancla: '2026-10-21' }) })).toBe(2);
  });
  it('agrupa casos y las filas sin caso por cliente', () => {
    const casos = casosDelPeriodo(filtrar(regs, f), CONFIG_DEFECTO);
    const t = casos.find((c) => c.caso === 'TASK0050017');
    expect(t).toMatchObject({ horas: 8.5, registros: 2, estado: 'M - Solucionado' });
    expect(casos.filter((c) => c.sinCaso).map((c) => [c.cliente, c.horas])).toEqual([['ACH', 4]]);
    expect(indicadores(filtrar(regs, f), CONFIG_DEFECTO).casos).toBe(casos.length);
  });
  it('mapa de calor', () => {
    const dias = diasDelRango(SEMANA);
    const m = mapaCalor(filtrar(regs, f), dias);
    expect(m.filas.map((x) => x.consultor)).toEqual(['Ana Perez', 'Luis Mora']);
    expect(m.total).toBe(m.totalesDia.reduce((a, b) => a + b, 0));
  });
  it('alertas: franja cruzada, sin caso, horas inválidas, sin fecha', () => {
    const al = evaluarAlertas(regs, CONFIG_DEFECTO);
    const tipos = (caso: string) => regs.filter((r) => r.caso === caso).flatMap((r) => al.get(r) ?? []);
    expect(tipos('DAV-EVO-028')).toEqual(['franjaCruzada', 'franjaCruzada']);
    expect(regs.filter((r) => r.caso === 'SINCASO' || r.caso === '0').every((r) => al.get(r)?.includes('sinCaso'))).toBe(true);
    expect(tipos('INC1604646')).toContain('horasInvalidas');
    expect(regs.filter((r) => r.fecha === null).every((r) => al.get(r)?.includes('sinFecha'))).toBe(true);
  });
  it('jornada larga por consultor y día', () => {
    expect(jornadasLargas(regs, 8).map((j) => `${j.consultor} ${j.fecha}`)).toContain('Ana Perez 2026-10-20');
    expect(jornadasLargas(regs, 100)).toEqual([]);
  });
});

const real = 'muestras/Bitácora Servicios AMS.xlsx';
describe.skipIf(!existsSync(real))('aceptación del tablero con la copia real', () => {
  const regs = cargar(real);
  const f = { rango: SEMANA, clientes: [], consultores: [], incluirFinDeSemana: false };
  const s = filtrar(regs, f);

  it('indicadores de la semana', () => {
    const i = indicadores(s, CONFIG_DEFECTO);
    expect(i).toMatchObject({ horas: 92, registros: 48, casos: 20, clientes: 5, consultores: 2 });
  });
  it('horas por cliente, consultor y tipo', () => {
    expect(Object.fromEntries(sumarPor(s, 'cliente').map((b) => [b.nombre, b.horas]))).toEqual({
      ACH: 56.5, 'Davivienda ERP': 20, 'Davivienda HCM': 8.5, 'U. Alberto H': 4, SDS: 3,
    });
    expect(sumarPor(s, 'consultor').map((b) => b.horas)).toEqual([49, 43]);
  });
  it('mapa de calor: Camilo 10, 10, 10, 9, 10 y Edwin 8,5, 8,5, 9, 8,5, 8,5', () => {
    const m = mapaCalor(s, diasDelRango(SEMANA));
    expect(m.filas.find((x) => x.consultor === 'Camilo Trujillo')?.porDia).toEqual([10, 10, 10, 9, 10]);
    expect(m.filas.find((x) => x.consultor === 'Edwin Villamil')?.porDia).toEqual([8.5, 8.5, 9, 8.5, 8.5]);
  });
  it('ACH de la semana por caso', () => {
    const ach = casosDelPeriodo(filtrar(regs, { ...f, clientes: ['ACH'] }), CONFIG_DEFECTO);
    const h = (c: string) => ach.find((x) => x.caso === c)?.horas;
    expect([h('TASK0050017'), h('PRB0043331'), h('TASK0050160'), h('TASK0050186'), h('TASK0050236')]).toEqual([21, 11.5, 7.5, 7.5, 2.5]);
    expect([h('TASK0050145'), h('TASK0050085'), h('SEGUIMIENTO ACH') ?? h('Seguimiento ACH')]).toEqual([2, 1, 1]);
    expect(ach.find((x) => x.sinCaso)?.horas).toBe(2.5);
  });
  it('alertas: 7 sin caso lun–vie y 3 registros el sábado', () => {
    const al = evaluarAlertas(regs, CONFIG_DEFECTO);
    const lv = s.filter((r) => al.get(r)?.includes('sinCaso'));
    expect(lv).toHaveLength(7);
    const sab = regs.filter((r) => r.fecha === '2026-10-24');
    expect(sab).toHaveLength(3);
    const r = resumenRevision(regs, al, rangoCompleto({ modo: 'semana', ancla: '2026-10-21' }));
    expect(r.finDeSemana).toBe(3);
    expect(r.habiles).toBe(10); // 7 sin caso + 3 casos no reconocidos (INVENTARIOS x2, Seguimiento ACH)
  });
});
