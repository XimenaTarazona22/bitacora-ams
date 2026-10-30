import type { ConfigApp } from './config';
import { clasificarCaso, redondear2 } from './normalizar';
import { type Periodo, enRango, esFinDeSemana, lunesDe, rangoPeriodo, semanaLV, sumarDias } from './periodos';
import type { Registro } from './tipos';

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const suma = (rs: Registro[]) => redondear2(rs.reduce((s, r) => s + r.horas, 0));
const porFechaFila = (a: Registro, b: Registro) => (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.fila - b.fila;

export const registrosDelCaso = (registros: Registro[], caso: string) => registros.filter((r) => r.caso === caso);

export interface Sugerencia {
  caso: string;
  cliente: string;
  titulo: string;
  horas: number;
  registros: number;
}

/** Casos que coinciden con el texto (código o palabras del título). Excluye las filas sin número de caso. */
export function buscarCasos(registros: Registro[], cfg: ConfigApp, consulta: string, limite = 8): Sugerencia[] {
  const q = sinTildes(consulta).trim();
  if (!q) return [];
  const palabras = q.split(/\s+/);
  const grupos = new Map<string, Registro[]>();
  for (const r of registros) {
    if (clasificarCaso(r.caso, cfg.casos) === 'sin_caso') continue;
    grupos.set(r.caso, [...(grupos.get(r.caso) ?? []), r]);
  }
  const hallados: { s: Sugerencia; puntos: number }[] = [];
  for (const [caso, rs] of grupos) {
    const c = sinTildes(caso);
    const titulos = sinTildes([...new Set(rs.map((r) => r.titulo))].join(' '));
    const puntos = c === q ? 3 : c.startsWith(q) ? 2 : c.includes(q) ? 1 : palabras.every((p) => titulos.includes(p) || c.includes(p)) ? 0 : -1;
    if (puntos < 0) continue;
    const ultimo = [...rs].sort(porFechaFila).reverse();
    hallados.push({
      puntos,
      s: { caso, cliente: ultimo[0]!.cliente, titulo: ultimo.find((r) => r.titulo)?.titulo ?? '', horas: suma(rs), registros: rs.length },
    });
  }
  return hallados
    .sort((a, b) => b.puntos - a.puntos || b.s.horas - a.s.horas)
    .slice(0, limite)
    .map((h) => h.s);
}

const CODIGO = /\b[A-Z]{2,6}\d{5,}\b|\b[A-Z]{2,6}-[A-Z]{2,6}-\d+\b/gi;

export interface Relacionado {
  caso: string;
  titulo: string;
  horas: number;
}

/** Casos cuyo código aparece en el título de este, o cuyo título menciona este código. */
export function casosRelacionados(registros: Registro[], caso: string): Relacionado[] {
  const titulosPorCaso = new Map<string, Set<string>>();
  for (const r of registros) {
    if (!r.caso || !r.titulo) continue;
    titulosPorCaso.set(r.caso, (titulosPorCaso.get(r.caso) ?? new Set()).add(r.titulo));
  }
  const codigosEn = (t: string) => (t.match(CODIGO) ?? []).map((c) => c.toUpperCase());
  const conocidos = new Set(registros.map((r) => r.caso));
  const rel = new Set<string>();

  for (const t of titulosPorCaso.get(caso) ?? []) for (const c of codigosEn(t)) if (c !== caso && conocidos.has(c)) rel.add(c);
  const esAlfanumerico = /[A-Z]/i.test(caso);
  if (esAlfanumerico) {
    for (const [otro, titulos] of titulosPorCaso) {
      if (otro !== caso && [...titulos].some((t) => codigosEn(t).includes(caso))) rel.add(otro);
    }
  }
  return [...rel].sort().map((c) => {
    const rs = registrosDelCaso(registros, c);
    return { caso: c, titulo: [...rs].sort(porFechaFila).reverse().find((r) => r.titulo)?.titulo ?? '', horas: suma(rs) };
  });
}

export interface SemanaHoras {
  lunes: string;
  /** Horas de lunes a viernes. */
  horas: number;
  /** Horas de sábado y domingo. */
  finDeSemana: number;
}

export interface FichaCaso {
  caso: string;
  cliente: string;
  tipo: string;
  titulo: string;
  consultores: string[];
  estado: string;
  estadoFecha: string | null;
  /** Todas las horas del caso, incluidas las de fin de semana. */
  horas: number;
  registros: number;
  primera: string | null;
  ultima: string | null;
  /** Horas lun–vie de la semana del periodo seleccionado. */
  horasSemana: number;
  /** Horas acumuladas hasta el fin (viernes) de esa semana. */
  acumuladoHastaSemana: number;
  semanas: SemanaHoras[];
  horasFinDeSemana: number;
  sinFecha: number;
}

export function fichaCaso(regs: Registro[], periodo: Periodo): FichaCaso | null {
  if (regs.length === 0) return null;
  const orden = [...regs].sort(porFechaFila).reverse(); // más reciente primero
  const conFecha = regs.filter((r) => r.fecha);
  const fechas = conFecha.map((r) => r.fecha!).sort();
  const semana = periodo.modo === 'semana' ? semanaLV(periodo.ancla) : rangoPeriodo(periodo);
  const ultimoConEstado = orden.find((r) => r.estado);

  const semanas: SemanaHoras[] = [];
  if (fechas.length) {
    for (let l = lunesDe(fechas[0]!); l <= lunesDe(fechas[fechas.length - 1]!); l = sumarDias(l, 7)) {
      const dentro = conFecha.filter((r) => enRango(r.fecha!, { desde: l, hasta: sumarDias(l, 6) }));
      semanas.push({
        lunes: l,
        horas: suma(dentro.filter((r) => !esFinDeSemana(r.fecha!))),
        finDeSemana: suma(dentro.filter((r) => esFinDeSemana(r.fecha!))),
      });
    }
  }

  return {
    caso: regs[0]!.caso,
    cliente: orden[0]!.cliente,
    tipo: orden.find((r) => r.tipo)?.tipo ?? '',
    titulo: orden.find((r) => r.titulo)?.titulo ?? '',
    consultores: [...new Set(regs.map((r) => r.consultor))].sort((a, b) => a.localeCompare(b, 'es')),
    estado: ultimoConEstado?.estado ?? '',
    estadoFecha: ultimoConEstado?.fecha ?? null,
    horas: suma(regs),
    registros: regs.length,
    primera: fechas[0] ?? null,
    ultima: fechas[fechas.length - 1] ?? null,
    horasSemana: suma(conFecha.filter((r) => enRango(r.fecha!, semana) && !esFinDeSemana(r.fecha!))),
    acumuladoHastaSemana: suma(conFecha.filter((r) => r.fecha! <= semana.hasta)),
    semanas,
    horasFinDeSemana: suma(conFecha.filter((r) => esFinDeSemana(r.fecha!))),
    sinFecha: regs.length - conFecha.length,
  };
}
