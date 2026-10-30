import type { ConfigApp } from './config';
import { tecnologiaDe } from './control';
import { clasificarCaso, redondear2 } from './normalizar';
import { type Rango, enRango, esFinDeSemana } from './periodos';
import type { Registro } from './tipos';

export interface Filtro {
  rango: Rango;
  /** Vacío = todos. */
  clientes: string[];
  consultores: string[];
  /** Vacío = todas; usa «Sin tecnología» para los casos sin dato. Opcional: sin Control no hay tecnologías. */
  tecnologias?: string[];
  incluirFinDeSemana: boolean;
}

const SIN_TEC = tecnologiaDe({ tecnologia: '' });
const suma = (regs: Registro[]) => redondear2(regs.reduce((s, r) => s + r.horas, 0));

function pasaFiltros(r: Registro, f: Filtro): boolean {
  return (
    r.fecha !== null &&
    enRango(r.fecha, f.rango) &&
    (f.clientes.length === 0 || f.clientes.includes(r.cliente)) &&
    (f.consultores.length === 0 || f.consultores.includes(r.consultor)) &&
    (!f.tecnologias?.length || f.tecnologias.includes(tecnologiaDe(r)))
  );
}

/** Registros del periodo y filtros; sábado y domingo solo si incluirFinDeSemana. */
export function filtrar(registros: Registro[], f: Filtro): Registro[] {
  return registros.filter((r) => pasaFiltros(r, f) && (f.incluirFinDeSemana || !esFinDeSemana(r.fecha!)));
}

/** Horas registradas en sábado/domingo dentro de los mismos filtros (para la nota «fuera de lun–vie»). */
export function horasFinDeSemana(registros: Registro[], f: Filtro): number {
  return suma(registros.filter((r) => pasaFiltros(r, f) && esFinDeSemana(r.fecha!)));
}

export interface Barra {
  nombre: string;
  horas: number;
}

export function sumarPor(regs: Registro[], campo: 'cliente' | 'tipo' | 'consultor' | 'tecnologia'): Barra[] {
  const m = new Map<string, number>();
  for (const r of regs) {
    const nombre = campo === 'tecnologia' ? tecnologiaDe(r) : r[campo] || '(vacío)';
    m.set(nombre, (m.get(nombre) ?? 0) + r.horas);
  }
  return [...m]
    .map(([nombre, horas]) => ({ nombre, horas: redondear2(horas) }))
    .sort((a, b) => b.horas - a.horas || a.nombre.localeCompare(b.nombre, 'es'));
}

export interface FilaCalor {
  consultor: string;
  porDia: number[];
  total: number;
}

export interface MapaCalor {
  dias: string[];
  filas: FilaCalor[];
  totalesDia: number[];
  total: number;
}

/** `clave` agrupa fechas en columnas (p. ej. por semana en periodos largos); por defecto, una columna por día. */
export function mapaCalor(regs: Registro[], dias: string[], clave: (fecha: string) => string = (f) => f): MapaCalor {
  const filas = new Map<string, number[]>();
  for (const r of regs) {
    const i = dias.indexOf(clave(r.fecha!));
    if (i < 0) continue;
    const f = filas.get(r.consultor) ?? dias.map(() => 0);
    f[i] = redondear2(f[i]! + r.horas);
    filas.set(r.consultor, f);
  }
  const lista = [...filas]
    .map(([consultor, porDia]) => ({ consultor, porDia, total: redondear2(porDia.reduce((a, b) => a + b, 0)) }))
    .sort((a, b) => a.consultor.localeCompare(b.consultor, 'es'));
  const totalesDia = dias.map((_, i) => redondear2(lista.reduce((s, f) => s + f.porDia[i]!, 0)));
  return { dias, filas: lista, totalesDia, total: redondear2(totalesDia.reduce((a, b) => a + b, 0)) };
}

export interface FilaCaso {
  clave: string;
  caso: string;
  sinCaso: boolean;
  cliente: string;
  titulo: string;
  /** Tecnología del caso; vacía si no hay dato. */
  tecnologia: string;
  consultores: string[];
  estado: string;
  horas: number;
  registros: number;
}

const porFechaFila = (a: Registro, b: Registro) => (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.fila - b.fila;

/** Agrupa por caso. Las filas sin número de caso se agrupan por cliente. */
export function casosDelPeriodo(regs: Registro[], cfg: ConfigApp): FilaCaso[] {
  const grupos = new Map<string, Registro[]>();
  for (const r of regs) {
    const sin = clasificarCaso(r.caso, cfg.casos) === 'sin_caso';
    const k = sin ? `sin|${r.cliente}` : r.caso;
    grupos.set(k, [...(grupos.get(k) ?? []), r]);
  }
  return [...grupos].map(([k, rs]) => {
    const orden = [...rs].sort(porFechaFila).reverse(); // más reciente primero
    const sinCaso = k.startsWith('sin|');
    return {
      clave: k,
      caso: sinCaso ? '' : k,
      sinCaso,
      cliente: orden[0]!.cliente,
      titulo: orden.find((r) => r.titulo)?.titulo ?? '',
      tecnologia: orden.find((r) => r.tecnologia)?.tecnologia ?? '',
      consultores: [...new Set(rs.map((r) => r.consultor))].sort((a, b) => a.localeCompare(b, 'es')),
      estado: orden.find((r) => r.estado)?.estado ?? '',
      horas: suma(rs),
      registros: rs.length,
    };
  });
}

export interface Indicadores {
  horas: number;
  consultores: number;
  registros: number;
  /** Casos distintos; las filas sin número de caso cuentan como un grupo por cliente. */
  casos: number;
  clientes: number;
  clienteTop: { nombre: string; porcentaje: number } | null;
}

export function indicadores(regs: Registro[], cfg: ConfigApp): Indicadores {
  const horas = suma(regs);
  const porCliente = sumarPor(regs, 'cliente');
  const top = porCliente[0];
  return {
    horas,
    consultores: new Set(regs.map((r) => r.consultor)).size,
    registros: regs.length,
    casos: casosDelPeriodo(regs, cfg).length,
    clientes: porCliente.length,
    clienteTop: top && horas > 0 ? { nombre: top.nombre, porcentaje: Math.round((top.horas / horas) * 100) } : null,
  };
}

export const valoresUnicos = (registros: Registro[], campo: 'cliente' | 'consultor') =>
  [...new Set(registros.map((r) => r[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

/** Tecnologías presentes, con «Sin tecnología» al final si algún registro no tiene dato. */
export function tecnologiasUnicas(registros: Registro[]): string[] {
  const set = new Set(registros.map(tecnologiaDe));
  const sin = set.delete(SIN_TEC);
  return [...[...set].sort((a, b) => a.localeCompare(b, 'es')), ...(sin ? [SIN_TEC] : [])];
}
