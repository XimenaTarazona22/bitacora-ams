import { CONFIG_CASOS_DEFECTO } from './normalizar';
import type { ConfigCasos, ReglaId } from './tipos';

export interface ConfigPdf {
  empresa: string;
  pie: string;
  papel: 'carta' | 'a4';
  /** inicial = «C. Trujillo»; completo = «Camilo Trujillo». */
  nombres: 'inicial' | 'completo';
}

export interface ConfigApp {
  casos: ConfigCasos;
  /** Si los registros de sábado y domingo suman en los totales (por defecto no). */
  sumarFinDeSemana: boolean;
  /** Horas por consultor y día a partir de las cuales la jornada se marca como larga. */
  jornadaLarga: number;
  formatoHoras: 'decimal' | 'hm';
  reglasActivas: Record<ReglaId, boolean>;
  /** Nombre en la bitácora → nombre a mostrar (vacío por defecto: cada cliente se mantiene separado). */
  aliasClientes: Record<string, string>;
  pdf: ConfigPdf;
}

export const CONFIG_DEFECTO: ConfigApp = {
  casos: CONFIG_CASOS_DEFECTO,
  sumarFinDeSemana: false,
  jornadaLarga: 10,
  formatoHoras: 'decimal',
  reglasActivas: {
    sinCaso: true,
    sinEstado: true,
    sinActividades: true,
    casoNoReconocido: true,
    finDeSemana: true,
    horasInvalidas: true,
    franjaCruzada: true,
    sinFecha: true,
    sinTecnologia: true,
    jornadaLarga: true,
  },
  aliasClientes: {},
  pdf: { empresa: '', pie: 'Fuente: bitácora de servicios AMS · horas en decimales', papel: 'carta', nombres: 'inicial' },
};

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const textos = (x: unknown): string[] | null =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean) : null;

export function patronValido(p: string): boolean {
  try {
    new RegExp(p, 'i');
    return true;
  } catch {
    return false;
  }
}

/** Mezcla un JSON cualquiera (importado o guardado) con los valores por defecto, descartando lo inválido. */
export function fusionarConfig(entrada: unknown): ConfigApp {
  const d = CONFIG_DEFECTO;
  if (!esObjeto(entrada)) return structuredClone(d);
  const casos = esObjeto(entrada.casos) ? entrada.casos : {};
  const reglas = esObjeto(entrada.reglasActivas) ? entrada.reglasActivas : {};
  const pdf = esObjeto(entrada.pdf) ? entrada.pdf : {};
  const alias = esObjeto(entrada.aliasClientes) ? entrada.aliasClientes : {};

  return {
    casos: {
      sinCaso: textos(casos.sinCaso) ?? [...d.casos.sinCaso],
      patrones: (textos(casos.patrones) ?? [...d.casos.patrones]).filter(patronValido),
      listaBlanca: textos(casos.listaBlanca) ?? [...d.casos.listaBlanca],
    },
    sumarFinDeSemana: typeof entrada.sumarFinDeSemana === 'boolean' ? entrada.sumarFinDeSemana : d.sumarFinDeSemana,
    jornadaLarga: typeof entrada.jornadaLarga === 'number' && entrada.jornadaLarga > 0 ? entrada.jornadaLarga : d.jornadaLarga,
    formatoHoras: entrada.formatoHoras === 'hm' ? 'hm' : 'decimal',
    reglasActivas: Object.fromEntries(
      (Object.keys(d.reglasActivas) as ReglaId[]).map((k) => [k, typeof reglas[k] === 'boolean' ? reglas[k] : d.reglasActivas[k]]),
    ) as Record<ReglaId, boolean>,
    aliasClientes: Object.fromEntries(
      Object.entries(alias).filter(([k, v]) => typeof v === 'string' && k.trim() && v.trim()).map(([k, v]) => [k.trim(), (v as string).trim()]),
    ),
    pdf: {
      empresa: typeof pdf.empresa === 'string' ? pdf.empresa : d.pdf.empresa,
      pie: typeof pdf.pie === 'string' ? pdf.pie : d.pdf.pie,
      papel: pdf.papel === 'a4' ? 'a4' : 'carta',
      nombres: pdf.nombres === 'completo' ? 'completo' : 'inicial',
    },
  };
}

export type { ConfigCasos };
