import { describe, expect, it } from 'vitest';
import { interpretarConfig, serializarConfig } from '../src/almacenamiento/config';
import { aplicarAlias } from '../src/dominio/alias';
import { CONFIG_DEFECTO, fusionarConfig, patronValido } from '../src/dominio/config';
import { clasificarCaso } from '../src/dominio/normalizar';
import type { Registro } from '../src/dominio/tipos';

describe('fusionarConfig', () => {
  it('devuelve los valores por defecto ante basura', () => {
    expect(fusionarConfig(null)).toEqual(CONFIG_DEFECTO);
    expect(fusionarConfig('x')).toEqual(CONFIG_DEFECTO);
    expect(fusionarConfig([])).toEqual(CONFIG_DEFECTO);
  });
  it('conserva lo válido y descarta lo inválido', () => {
    const c = fusionarConfig({
      jornadaLarga: 8,
      formatoHoras: 'hm',
      sumarFinDeSemana: true,
      casos: { patrones: ['^\\d+$', '([', '^OK-\\d+$'], listaBlanca: ['Seguimiento ACH', 5] },
      reglasActivas: { sinEstado: false, sinCaso: 'si' },
      aliasClientes: { 'Davivienda HCM': 'Davivienda', vacio: '', '': 'x' },
      pdf: { papel: 'a4', nombres: 'completo', empresa: 'ACME' },
    });
    expect(c.jornadaLarga).toBe(8);
    expect(c.formatoHoras).toBe('hm');
    expect(c.sumarFinDeSemana).toBe(true);
    expect(c.casos.patrones).toEqual(['^\\d+$', '^OK-\\d+$']);
    expect(c.casos.listaBlanca).toEqual(['Seguimiento ACH']);
    expect(c.reglasActivas.sinEstado).toBe(false);
    expect(c.reglasActivas.sinCaso).toBe(true); // valor no booleano: se usa el predeterminado
    expect(c.aliasClientes).toEqual({ 'Davivienda HCM': 'Davivienda' });
    expect(c.pdf).toMatchObject({ papel: 'a4', nombres: 'completo', empresa: 'ACME' });
    expect(c.pdf.pie).toBe(CONFIG_DEFECTO.pdf.pie);
  });
  it('rechaza jornadas no positivas', () => expect(fusionarConfig({ jornadaLarga: 0 }).jornadaLarga).toBe(10));
  it('no comparte referencias con los valores por defecto', () => {
    const c = fusionarConfig(null);
    c.casos.sinCaso.push('X');
    expect(CONFIG_DEFECTO.casos.sinCaso).not.toContain('X');
  });
  it('valida patrones', () => {
    expect(patronValido('^\\d+$')).toBe(true);
    expect(patronValido('([')).toBe(false);
  });
});

describe('exportar e importar', () => {
  const logo = 'data:image/png;base64,iVBORw0KGgo=';
  it('ida y vuelta con logo', () => {
    const c = fusionarConfig({ jornadaLarga: 9, pdf: { empresa: 'ACME' } });
    expect(interpretarConfig(serializarConfig(c, logo))).toEqual({ config: c, logo });
  });
  it('acepta la configuración suelta y descarta logos que no son imagen', () => {
    expect(interpretarConfig('{"jornadaLarga": 7}').config.jornadaLarga).toBe(7);
    expect(interpretarConfig('{"config":{},"logo":"data:text/html;base64,AAAA"}').logo).toBeNull();
  });
  it('falla con mensajes claros', () => {
    expect(() => interpretarConfig('no es json')).toThrow(/JSON válido/);
    expect(() => interpretarConfig('5')).toThrow(/configuración/);
  });
});

describe('alias de clientes', () => {
  const r = (cliente: string) => ({ cliente }) as Registro;
  it('sustituye sin distinguir mayúsculas', () => {
    const rs = [r('Davivienda HCM'), r('davivienda hcm'), r('ACH')];
    expect(aplicarAlias(rs, { 'Davivienda HCM': 'Davivienda' }).map((x) => x.cliente)).toEqual(['Davivienda', 'Davivienda', 'ACH']);
  });
  it('sin alias devuelve el mismo arreglo', () => {
    const rs = [r('ACH')];
    expect(aplicarAlias(rs, {})).toBe(rs);
  });
});

describe('caso vacío', () => {
  it('siempre es sin caso, aunque se edite la lista', () => {
    expect(clasificarCaso('', { sinCaso: [], patrones: [], listaBlanca: [] })).toBe('sin_caso');
  });
});
