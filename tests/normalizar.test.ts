import { describe, expect, it } from 'vitest';
import {
  clasificarCaso, esHojaConsultor, fraccionAHoras, mapearColumnas, normalizarCaso,
  normalizarEncabezado, redondear2, serialAFecha,
} from '../src/dominio/normalizar';

describe('encabezados', () => {
  it('ignora tildes, mayúsculas y espacios', () => {
    expect(normalizarEncabezado('  Título   del Caso ')).toBe('titulo del caso');
    expect(normalizarEncabezado('N° Caso')).toBe('n caso');
  });
  it('unifica Caso y No Caso', () => {
    expect(mapearColumnas(['Fecha', 'Cliente', 'Caso']).caso).toBe(2);
    expect(mapearColumnas(['Fecha', 'Cliente', 'No Caso']).caso).toBe(2);
  });
  it('detecta hojas de consultor por encabezado', () => {
    expect(esHojaConsultor(['Fecha', 'Cliente', 'Consultor', 'Tipo', 'No Caso'])).toBe(true);
    expect(esHojaConsultor(['Cliente', '(Todas)'])).toBe(false);
    expect(esHojaConsultor([])).toBe(false);
  });
});

describe('caso', () => {
  it('normaliza números, códigos y espacios', () => {
    expect(normalizarCaso(3732)).toBe('3732');
    expect(normalizarCaso('3732.0')).toBe('3732');
    expect(normalizarCaso('  prb0043331 ')).toBe('PRB0043331');
    expect(normalizarCaso('Seguimiento  ACH')).toBe('Seguimiento ACH');
    expect(normalizarCaso(null)).toBe('');
  });
  it('clasifica', () => {
    expect(clasificarCaso('')).toBe('sin_caso');
    expect(clasificarCaso('0')).toBe('sin_caso');
    expect(clasificarCaso('SINCASO')).toBe('sin_caso');
    expect(clasificarCaso('3732')).toBe('valido');
    expect(clasificarCaso('TASK0050017')).toBe('valido');
    expect(clasificarCaso('DAV-EVO-028')).toBe('valido');
    expect(clasificarCaso('IN')).toBe('no_reconocido');
    expect(clasificarCaso('Seguimiento ACH')).toBe('no_reconocido');
    expect(clasificarCaso('Seguimiento ACH', { sinCaso: [], patrones: [], listaBlanca: ['seguimiento ach'] })).toBe('valido');
  });
});

describe('fechas y horas', () => {
  it('serial → fecha', () => {
    expect(serialAFecha(46237)).toBe('2026-08-03');
    expect(serialAFecha('2026-10-19T05:00:00Z')).toBe('2026-10-19');
    expect(serialAFecha(null)).toBeNull();
  });
  it('fracción → horas y redondeo', () => {
    expect(fraccionAHoras(0.5)).toBe(12);
    expect(fraccionAHoras('x')).toBeNull();
    expect(redondear2(3.999999999999999)).toBe(4);
    expect(redondear2(7.999999)).toBe(8);
  });
});
