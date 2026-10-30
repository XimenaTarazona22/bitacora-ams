import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filtrar, sumarPor, tecnologiasUnicas } from '../src/dominio/agregaciones';
import { CONFIG_DEFECTO } from '../src/dominio/config';
import { SIN_TECNOLOGIA, aplicarTecnologia, claveCaso, leerControl } from '../src/dominio/control';
import { construirInforme, nombreArchivoInforme, opcionesPorDefecto } from '../src/dominio/informe';
import { leerLibro } from '../src/dominio/leerLibro';
import { semanaLV } from '../src/dominio/periodos';
import { evaluarAlertas } from '../src/dominio/reglas';
import { crearPdf, definicionInforme } from '../src/pdf/informeCliente';

const bytes = (ruta: string) => new Uint8Array(readFileSync(ruta));
const SEMANA = semanaLV('2026-10-21');
const r2 = (n: number) => Math.round(n * 100) / 100;

describe('claveCaso', () => {
  it('iguala espacios, mayúsculas, números y el prefijo IM-', () => {
    expect(claveCaso('TASK0050017 ')).toBe('TASK0050017');
    expect(claveCaso('task0050017')).toBe('TASK0050017');
    expect(claveCaso(3732)).toBe('3732');
    expect(claveCaso('IM-74312')).toBe('74312');
    expect(claveCaso('IM 74312')).toBe('74312');
    expect(claveCaso('IM74312')).toBe('74312');
    expect(claveCaso(74312)).toBe('74312');
    expect(claveCaso('Seguimiento ACH')).toBe('SEGUIMIENTO ACH');
    expect(claveCaso(null)).toBe('');
  });
});

describe('leerControl (fixture)', () => {
  const c = leerControl(bytes('fixtures/control-sintetico.xlsx'));
  it('encuentra la hoja por sus encabezados e ignora las demás', () => {
    expect(c.hoja).toBe('Registro_Casos');
  });
  it('lee caso y tecnología', () => {
    expect(c.tecnologias).toMatchObject({ TASK0050017: 'HCM', PRB0043331: 'ERP', '3732': 'PeopleSoft', 'DAV-EVO-028': 'GCP', '74312': 'PeopleSoft' });
    expect(c.tecnologias.TASK0000001).toBeUndefined();
    expect(c.filasSinTecnologia).toBe(1);
  });
  it('reporta casos con más de una tecnología y usa la primera', () => {
    expect(c.conflictos).toEqual([{ caso: 'INC1604646', tecnologias: ['ERP', 'HCM'] }]);
    expect(c.tecnologias.INC1604646).toBe('ERP');
  });
  it('un libro sin las columnas devuelve hoja vacía (la app lo rechaza con un mensaje)', () => {
    expect(leerControl(bytes('fixtures/bitacora-sintetica.xlsx')).hoja).toBe('');
  });
});

describe('tecnología en los registros', () => {
  const regs = leerLibro(bytes('fixtures/bitacora-sintetica.xlsx')).registros;
  const tec = leerControl(bytes('fixtures/control-sintetico.xlsx')).tecnologias;
  const conTec = aplicarTecnologia(regs, tec);
  const de = (caso: string) => [...new Set(conTec.filter((r) => r.caso === caso).map((r) => r.tecnologia))];

  it('cruza por número de caso, ignorando espacios y el prefijo IM-', () => {
    expect(de('TASK0050017')).toEqual(['HCM']);
    expect(de('3732')).toEqual(['PeopleSoft']);
    expect(de('DAV-EVO-028')).toEqual(['GCP']);
    expect(de('123')).toEqual(['']);
    const im = aplicarTecnologia([{ ...regs[0]!, caso: 'IM-74312' }], tec);
    expect(im[0]!.tecnologia).toBe('PeopleSoft');
  });
  it('sin Control devuelve el mismo arreglo', () => expect(aplicarTecnologia(regs, null)).toBe(regs));

  it('alerta «Sin tecnología» solo con Control y solo para casos con número', () => {
    const sin = evaluarAlertas(conTec, CONFIG_DEFECTO, false);
    expect([...sin.values()].flat()).not.toContain('sinTecnologia');
    const con = evaluarAlertas(conTec, CONFIG_DEFECTO, true);
    const marcados = conTec.filter((r) => con.get(r)?.includes('sinTecnologia')).map((r) => r.caso);
    expect(marcados.sort()).toEqual(['123']); // SINCASO, 0 y vacío son sin caso; «Seguimiento ACH» no es válido
    const apagada = { ...CONFIG_DEFECTO, reglasActivas: { ...CONFIG_DEFECTO.reglasActivas, sinTecnologia: false } };
    expect([...evaluarAlertas(conTec, apagada, true).values()].flat()).not.toContain('sinTecnologia');
  });

  it('filtra y suma por tecnología, con «Sin tecnología»', () => {
    const f = { rango: SEMANA, clientes: [], consultores: [], incluirFinDeSemana: false };
    const hcm = filtrar(conTec, { ...f, tecnologias: ['HCM'] });
    expect(hcm.length).toBeGreaterThan(0);
    expect(hcm.every((r) => r.tecnologia === 'HCM')).toBe(true);
    const sin = filtrar(conTec, { ...f, tecnologias: [SIN_TECNOLOGIA] });
    expect(sin.every((r) => r.tecnologia === '')).toBe(true);
    const barras = sumarPor(filtrar(conTec, f), 'tecnologia');
    expect(barras.some((b) => b.nombre === SIN_TECNOLOGIA)).toBe(true);
    expect(r2(barras.reduce((s, b) => s + b.horas, 0))).toBe(r2(filtrar(conTec, f).reduce((s, r) => s + r.horas, 0)));
    expect(tecnologiasUnicas(conTec).at(-1)).toBe(SIN_TECNOLOGIA);
  });

  it('informe: columna de tecnología, subtítulo y nombre de archivo', () => {
    const solo = conTec.filter((r) => r.tecnologia === 'HCM');
    const o = { ...opcionesPorDefecto('ACH', SEMANA, CONFIG_DEFECTO), tecnologia: 'HCM' };
    const i = construirInforme(solo, CONFIG_DEFECTO, o, {}, '2026-10-29');
    expect(i.filas.length).toBeGreaterThan(0);
    expect(i.filas.every((f) => f.tecnologia === 'HCM')).toBe(true);
    const doc = JSON.stringify(definicionInforme(i, CONFIG_DEFECTO, null).content);
    expect(doc).toContain('Tecnología: HCM');
    expect(doc).toContain('"text":"Tecnología"');
    // sin datos de tecnología la columna no aparece
    const sinDatos = construirInforme(regs, CONFIG_DEFECTO, opcionesPorDefecto('ACH', SEMANA, CONFIG_DEFECTO), {}, '2026-10-29');
    expect(JSON.stringify(definicionInforme(sinDatos, CONFIG_DEFECTO, null).content)).not.toContain('"text":"Tecnología"');
    expect(nombreArchivoInforme('ACH', SEMANA, 'HCM')).toBe('Informe_horas_ACH_HCM_2026-10-19_al_2026-10-23.pdf');
    expect(nombreArchivoInforme('ACH', SEMANA, SIN_TECNOLOGIA)).toBe('Informe_horas_ACH_Sin_tecnología_2026-10-19_al_2026-10-23.pdf');
    expect(nombreArchivoInforme('ACH', SEMANA)).toBe('Informe_horas_ACH_2026-10-19_al_2026-10-23.pdf');
  });

  it('genera el PDF con tecnología', async () => {
    const i = construirInforme(conTec, CONFIG_DEFECTO, opcionesPorDefecto('ACH', SEMANA, CONFIG_DEFECTO), {}, '2026-10-29');
    expect((await crearPdf(i, CONFIG_DEFECTO, null)).size).toBeGreaterThan(5000);
  });
});

const REAL_CONTROL = 'muestras/Control_Seguimiento_AMS.xlsx';
const REAL_BITACORA = 'muestras/Bitácora Servicios AMS.xlsx';
describe.skipIf(!existsSync(REAL_CONTROL) || !existsSync(REAL_BITACORA))('Control real', () => {
  const c = leerControl(bytes(REAL_CONTROL));
  const regs = aplicarTecnologia(leerLibro(bytes(REAL_BITACORA)).registros, c.tecnologias);

  it('lee la hoja Registro_Casos con unos 320 casos y sin conflictos', () => {
    expect(c.hoja).toBe('Registro_Casos');
    expect(c.casos).toBe(320);
    expect(c.conflictos).toEqual([]);
  });
  it('cruza los casos de Fiduprevisora (IM-) y los de Davivienda HCM que el Control lista como Bolivar', () => {
    const t = (caso: string) => regs.find((r) => r.caso === caso)?.tecnologia;
    expect(t('IM-74312')).toBe('PeopleSoft');
    expect(t('4373')).toBe('HCM');
    expect(t('PRB0043331')).toBe('HCM');
  });
  it('TASK0050017 no está en el Control: queda sin tecnología', () => {
    expect(regs.find((r) => r.caso === 'TASK0050017')?.tecnologia).toBe('');
  });
  it('cobertura: entre un tercio y dos tercios de las horas tienen tecnología', () => {
    const total = regs.reduce((s, r) => s + r.horas, 0);
    const con = regs.filter((r) => r.tecnologia).reduce((s, r) => s + r.horas, 0);
    expect(con / total).toBeGreaterThan(0.3);
    expect(con / total).toBeLessThan(0.7);
  });
});
