import type { ConfigApp } from './config';
import { estadoSinPrefijo } from './formato';
import { clasificarCaso, normalizarCaso, redondear2 } from './normalizar';
import { type Rango, diasDelRango, enRango, esFinDeSemana } from './periodos';
import { actividadesUnicas, textoRepresentativo } from './resumenActividades';
import type { Registro } from './tipos';

export interface ContenidoInforme {
  horasPorCaso: boolean;
  acumulado: boolean;
  resumen: boolean;
  detallePorDia: boolean;
  consultor: boolean;
  grafica: boolean;
}

export interface OpcionesInforme {
  cliente: string;
  rango: Rango;
  casos: 'todos' | 'solicitados';
  /** Códigos pedidos por el cliente (ya normalizados). */
  solicitados: string[];
  contenido: ContenidoInforme;
  sinCaso: 'agrupar' | 'excluir';
  finDeSemana: 'incluir' | 'excluir';
  sinEstado: 'incluir' | 'excluir';
  nota: string;
}

export const CONTENIDO_DEFECTO: ContenidoInforme = {
  horasPorCaso: true, acumulado: true, resumen: true, detallePorDia: false, consultor: true, grafica: false,
};

export function opcionesPorDefecto(cliente: string, rango: Rango, cfg: ConfigApp): OpcionesInforme {
  return {
    cliente, rango, casos: 'todos', solicitados: [], contenido: { ...CONTENIDO_DEFECTO },
    sinCaso: 'agrupar', finDeSemana: cfg.sumarFinDeSemana ? 'incluir' : 'excluir', sinEstado: 'incluir', nota: '',
  };
}

const suma = (rs: Registro[]) => redondear2(rs.reduce((s, r) => s + r.horas, 0));
const porFechaFila = (a: Registro, b: Registro) => (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.fila - b.fila;
const MAX_RESUMEN = 400;

/** Separa códigos pegados por coma, espacio o salto de línea y los normaliza, sin repetidos. */
export function separarCodigos(texto: string): string[] {
  return [...new Set(texto.split(/[\s,;]+/).map(normalizarCaso).filter(Boolean))];
}

export interface Verificacion {
  registrosSinCaso: number;
  horasSinCaso: number;
  registrosFinDeSemana: number;
  horasFinDeSemana: number;
  registrosSinEstado: number;
  horasSinEstado: number;
}

/** Lo que el informe no debería llevar sin que alguien decida: sin caso, fin de semana y sin estado. */
export function verificarInforme(registros: Registro[], cfg: ConfigApp, cliente: string, rango: Rango): Verificacion {
  const rs = registros.filter((r) => r.cliente === cliente && r.fecha && enRango(r.fecha, rango));
  const sinCaso = rs.filter((r) => clasificarCaso(r.caso, cfg.casos) === 'sin_caso');
  const finde = rs.filter((r) => esFinDeSemana(r.fecha!));
  const sinEstado = rs.filter((r) => !r.estado);
  return {
    registrosSinCaso: sinCaso.length, horasSinCaso: suma(sinCaso),
    registrosFinDeSemana: finde.length, horasFinDeSemana: suma(finde),
    registrosSinEstado: sinEstado.length, horasSinEstado: suma(sinEstado),
  };
}

export interface FilaInforme {
  /** Clave estable para guardar el resumen editado. */
  clave: string;
  caso: string;
  descripcion: string;
  consultores: string[];
  estado: string;
  horas: number;
  /** Horas desde el inicio hasta el fin del periodo; null en «Actividades generales». */
  acumulado: number | null;
  resumen: string;
  resumenBorrador: string;
  general: boolean;
}

export interface Informe {
  opciones: OpcionesInforme;
  emitido: string;
  filas: FilaInforme[];
  totalHoras: number;
  totalAcumulado: number;
  casos: number;
  consultores: string[];
  dias: string[];
  horasPorDia: number[];
  /** Horas de cada fila por día (mismo orden que filas y dias). */
  detalle: number[][];
  /** Códigos pedidos que no aparecen en el periodo. */
  noEncontrados: string[];
}

const CLAVE_GENERAL = 'SIN-CASO';
export const claveResumen = (cliente: string, clave: string, rango: Rango) => `${cliente}|${clave}|${rango.desde}|${rango.hasta}`;

export function construirInforme(
  registros: Registro[],
  cfg: ConfigApp,
  o: OpcionesInforme,
  resumenesGuardados: Record<string, string>,
  emitido: string,
): Informe {
  const delCliente = registros.filter((r) => r.cliente === o.cliente && r.fecha && enRango(r.fecha, o.rango));
  const noEncontrados = o.casos === 'solicitados' ? o.solicitados.filter((c) => !delCliente.some((r) => r.caso === c)) : [];

  const incluye = (r: Registro) => {
    if (o.finDeSemana === 'excluir' && esFinDeSemana(r.fecha!)) return false;
    if (o.sinEstado === 'excluir' && !r.estado) return false;
    const sin = clasificarCaso(r.caso, cfg.casos) === 'sin_caso';
    if (sin) return o.casos === 'todos' && o.sinCaso === 'agrupar';
    return o.casos === 'todos' || o.solicitados.includes(r.caso);
  };
  const base = delCliente.filter(incluye);

  const grupos = new Map<string, Registro[]>();
  for (const r of base) {
    const k = clasificarCaso(r.caso, cfg.casos) === 'sin_caso' ? CLAVE_GENERAL : r.caso;
    grupos.set(k, [...(grupos.get(k) ?? []), r]);
  }

  const filas: FilaInforme[] = [...grupos].map(([clave, rs]) => {
    const general = clave === CLAVE_GENERAL;
    const recientes = [...rs].sort(porFechaFila).reverse();
    const borrador = textoRepresentativo(actividadesUnicas(rs), MAX_RESUMEN);
    const acumulado = general
      ? null
      : suma(registros.filter((r) => r.caso === clave && r.fecha && r.fecha <= o.rango.hasta)); // todas las horas, igual que Buscar caso
    return {
      clave,
      caso: general ? '—' : clave,
      descripcion: general ? 'Actividades generales' : recientes.find((r) => r.titulo)?.titulo ?? '',
      consultores: [...new Set(rs.map((r) => r.consultor))].sort((a, b) => a.localeCompare(b, 'es')),
      estado: estadoSinPrefijo(recientes.find((r) => r.estado)?.estado ?? ''),
      horas: suma(rs),
      acumulado,
      resumen: resumenesGuardados[claveResumen(o.cliente, clave, o.rango)] ?? borrador,
      resumenBorrador: borrador,
      general,
    };
  });
  // Más horas primero; «Actividades generales» siempre al final.
  filas.sort((a, b) => Number(a.general) - Number(b.general) || b.horas - a.horas || a.caso.localeCompare(b.caso));

  const dias = diasDelRango(o.rango, o.finDeSemana === 'incluir');
  const detalle = filas.map((f) =>
    dias.map((d) => suma(base.filter((r) => r.fecha === d && (clasificarCaso(r.caso, cfg.casos) === 'sin_caso' ? CLAVE_GENERAL : r.caso) === f.clave))),
  );

  return {
    opciones: o,
    emitido,
    filas,
    totalHoras: suma(base),
    totalAcumulado: redondear2(filas.reduce((s, f) => s + (f.acumulado ?? 0), 0)),
    casos: filas.filter((f) => !f.general).length,
    consultores: [...new Set(base.map((r) => r.consultor))].sort((a, b) => a.localeCompare(b, 'es')),
    dias,
    horasPorDia: dias.map((d) => suma(base.filter((r) => r.fecha === d))),
    detalle,
    noEncontrados,
  };
}

/** Clientes con registros en el periodo, respetando la opción de fin de semana. */
export function clientesDelPeriodo(registros: Registro[], rango: Rango, incluirFinDeSemana: boolean): string[] {
  return [...new Set(registros.filter((r) => r.cliente && r.fecha && enRango(r.fecha, rango) && (incluirFinDeSemana || !esFinDeSemana(r.fecha)))
    .map((r) => r.cliente))].sort((a, b) => a.localeCompare(b, 'es'));
}

/** «Camilo Trujillo» → «C. Trujillo»; con modo completo no cambia. */
export function nombreParaPdf(nombre: string, modo: 'inicial' | 'completo'): string {
  const partes = nombre.trim().split(/\s+/);
  if (modo === 'completo' || partes.length < 2) return nombre.trim();
  return `${partes[0]!.charAt(0).toUpperCase()}. ${partes[partes.length - 1]}`;
}

/** Informe_horas_<Cliente>_<AAAA-MM-DD>_al_<AAAA-MM-DD>.pdf sin caracteres inválidos. */
export function nombreArchivoInforme(cliente: string, rango: Rango): string {
  const limpio = cliente.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').replace(/^\.+|\.+$/g, '') || 'Cliente';
  return `Informe_horas_${limpio}_${rango.desde}_al_${rango.hasta}.pdf`;
}
