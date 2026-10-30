import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { CONFIG_DEFECTO } from '../src/dominio/config';
import { construirInforme, opcionesPorDefecto } from '../src/dominio/informe';
import { leerLibro } from '../src/dominio/leerLibro';
import { crearPdf, definicionInforme, empaquetarZip } from '../src/pdf/informeCliente';

const regs = leerLibro(new Uint8Array(readFileSync('fixtures/bitacora-sintetica.xlsx'))).registros;
const SEMANA = { desde: '2026-10-19', hasta: '2026-10-23' };
const informe = (cliente: string, extra = {}) =>
  construirInforme(regs, CONFIG_DEFECTO, { ...opcionesPorDefecto(cliente, SEMANA, CONFIG_DEFECTO), ...extra }, {}, '2026-10-29');

const textos = (n: unknown): string[] =>
  typeof n === 'string' ? [n] : Array.isArray(n) ? n.flatMap(textos) : n && typeof n === 'object' ? Object.values(n).flatMap(textos) : [];

describe('definición del PDF', () => {
  it('Carta por defecto y A4 si se configura', () => {
    expect(definicionInforme(informe('ACH'), CONFIG_DEFECTO, null).pageSize).toBe('LETTER');
    expect(definicionInforme(informe('ACH'), { ...CONFIG_DEFECTO, pdf: { ...CONFIG_DEFECTO.pdf, papel: 'a4' } }, null).pageSize).toBe('A4');
  });
  it('lleva título, periodo, caso en tabla, resumen y total', () => {
    const t = textos(definicionInforme(informe('ACH'), CONFIG_DEFECTO, null).content).join('|');
    expect(t).toContain('ACH · Horas invertidas por caso');
    expect(t).toContain('Lunes 19 – viernes 23 de octubre de 2026');
    expect(t).toContain('TASK0050017');
    expect(t).toContain('Actividades generales');
    expect(t).toContain('Total');
    expect(t).toContain('Resumen de actividades');
    expect(t).not.toContain('Buenas tardes');
  });
  it('las opciones apagadas no aparecen', () => {
    const o = informe('ACH', { contenido: { horasPorCaso: true, acumulado: false, resumen: false, detallePorDia: false, consultor: false, grafica: false, tecnologia: true } });
    const t = textos(definicionInforme(o, CONFIG_DEFECTO, null).content).join('|');
    expect(t).not.toContain('Acumulado');
    expect(textos(definicionInforme(o, CONFIG_DEFECTO, null).content)).not.toContain('Consultor'); // la columna; «Consultores» del indicador sí queda
    expect(t).not.toContain('Resumen de actividades');
  });
  it('detalle por día, gráfica y nota solo si se piden', () => {
    const o = informe('ACH', { nota: 'Nota de prueba', contenido: { horasPorCaso: true, acumulado: true, resumen: true, detallePorDia: true, consultor: true, grafica: true, tecnologia: true } });
    const t = textos(definicionInforme(o, CONFIG_DEFECTO, null).content).join('|');
    expect(t).toContain('Detalle por día');
    expect(t).toContain('Horas por día');
    expect(t).toContain('Nota de prueba');
  });
  it('muestra iniciales y apellido del consultor', () => {
    expect(textos(definicionInforme(informe('ACH'), CONFIG_DEFECTO, null).content).join('|')).toContain('A. Perez');
  });
  it('casos con espacios no usan la fuente monoespaciada', () => {
    const doc = JSON.stringify(definicionInforme(informe('SDS'), CONFIG_DEFECTO, null).content);
    expect(doc).toContain('Seguimiento ACH');
    expect(doc).not.toMatch(/"text":"Seguimiento ACH"[^}]*PlexMono/);
  });
});

describe('generación real', () => {
  it('produce un PDF válido', async () => {
    const blob = await crearPdf(informe('ACH', { contenido: { horasPorCaso: true, acumulado: true, resumen: true, detallePorDia: true, consultor: true, grafica: true, tecnologia: true } }), CONFIG_DEFECTO, null);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(5000);
  });
  it('genera el PDF de un caso con espacios en el nombre', async () => {
    const blob = await crearPdf(informe('SDS', { contenido: { horasPorCaso: true, acumulado: true, resumen: true, detallePorDia: true, consultor: true, grafica: true, tecnologia: true } }), CONFIG_DEFECTO, null);
    expect(blob.size).toBeGreaterThan(5000);
  });
  it('un cliente sin horas también genera un PDF', async () => {
    const blob = await crearPdf(informe('NoExiste'), CONFIG_DEFECTO, null);
    expect(blob.size).toBeGreaterThan(1000);
  });
  it('empaqueta varios PDF en un .zip sin repetir nombres', async () => {
    const a = informe('ACH');
    const pdf = await crearPdf(a, CONFIG_DEFECTO, null);
    const zip = await JSZip.loadAsync(await (await empaquetarZip([{ informe: a, blob: pdf }, { informe: a, blob: pdf }])).arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['Informe_horas_ACH_2026-10-19_al_2026-10-23.pdf', 'Informe_horas_ACH_2026-10-19_al_2026-10-23_2.pdf']);
  });
});

describe('texto libre problemático', () => {
  it('no falla con símbolos, emoji, tabs y comillas curvas', async () => {
    const raros = regs.map((r) => ({ ...r, actividades: 'Se valida → ≥ 10 h “ok” … 😀\tfin ✓ α ñ Ñ', titulo: 'Título ≥ “raro” 😀' }));
    const i = construirInforme(raros, CONFIG_DEFECTO, opcionesPorDefecto('ACH', SEMANA, CONFIG_DEFECTO), {}, '2026-10-29');
    const blob = await crearPdf(i, CONFIG_DEFECTO, null);
    expect(blob.size).toBeGreaterThan(5000);
  });
});

import { existsSync } from 'node:fs';
import { clientesDelPeriodo } from '../src/dominio/informe';
const real = 'muestras/Bitácora Servicios AMS.xlsx';
describe.skipIf(!existsSync(real))('PDF con la copia real', () => {
  it('genera el informe de cada cliente de la semana con todo el contenido', async () => {
    const reales = leerLibro(new Uint8Array(readFileSync(real))).registros;
    const todo = { horasPorCaso: true, acumulado: true, resumen: true, detallePorDia: true, consultor: true, grafica: true, tecnologia: true };
    const clientes = clientesDelPeriodo(reales, SEMANA, false);
    expect(clientes).toHaveLength(5);
    for (const c of clientes) {
      const i = construirInforme(reales, CONFIG_DEFECTO, { ...opcionesPorDefecto(c, SEMANA, CONFIG_DEFECTO), contenido: todo }, {}, '2026-10-29');
      const blob = await crearPdf(i, CONFIG_DEFECTO, null);
      expect(blob.size, c).toBeGreaterThan(5000);
    }
  });
});
