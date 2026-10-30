// Fechas como texto AAAA-MM-DD; todo el cálculo en UTC para evitar desfases de zona horaria.
export interface Rango {
  desde: string;
  hasta: string;
}

export type ModoPeriodo = 'semana' | 'dia';
export interface Periodo {
  modo: ModoPeriodo;
  /** Cualquier fecha del periodo (en modo semana, la semana que la contiene). */
  ancla: string;
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const aFecha = (iso: string) => new Date(`${iso}T00:00:00Z`);
const aISO = (d: Date) => d.toISOString().slice(0, 10);

export const sumarDias = (iso: string, n: number) => aISO(new Date(aFecha(iso).getTime() + n * 864e5));

/** 0 = lunes … 6 = domingo */
export const diaSemana = (iso: string) => (aFecha(iso).getUTCDay() + 6) % 7;
export const esFinDeSemana = (iso: string) => diaSemana(iso) >= 5;
export const lunesDe = (iso: string) => sumarDias(iso, -diaSemana(iso));
export const enRango = (iso: string, r: Rango) => iso >= r.desde && iso <= r.hasta;

/** Lunes a viernes de la semana que contiene la fecha. */
export function semanaLV(iso: string): Rango {
  const lunes = lunesDe(iso);
  return { desde: lunes, hasta: sumarDias(lunes, 4) };
}

/** Rango visible del periodo: lun–vie en semana, un solo día en vista diaria. */
export function rangoPeriodo(p: Periodo): Rango {
  return p.modo === 'semana' ? semanaLV(p.ancla) : { desde: p.ancla, hasta: p.ancla };
}

/** Igual que rangoPeriodo, pero la semana llega hasta el domingo (para contar alertas de fin de semana). */
export function rangoCompleto(p: Periodo): Rango {
  const r = rangoPeriodo(p);
  return p.modo === 'semana' ? { desde: r.desde, hasta: sumarDias(r.desde, 6) } : r;
}

/** Fechas del rango; con finDeSemana=false se omiten sábados y domingos. */
export function diasDelRango(r: Rango, finDeSemana = false): string[] {
  const dias: string[] = [];
  for (let d = r.desde; d <= r.hasta; d = sumarDias(d, 1)) if (finDeSemana || !esFinDeSemana(d)) dias.push(d);
  return dias;
}

/** Mueve el periodo: una semana, o un día hábil en vista diaria. */
export function moverPeriodo(p: Periodo, sentido: 1 | -1): Periodo {
  if (p.modo === 'semana') return { ...p, ancla: sumarDias(p.ancla, 7 * sentido) };
  let d = sumarDias(p.ancla, sentido);
  while (esFinDeSemana(d)) d = sumarDias(d, sentido);
  return { ...p, ancla: d };
}

/** Semana de hoy si tiene registros; si no, la de la fecha más reciente de la bitácora. */
export function periodoInicial(fechas: string[], hoy: string): Periodo {
  const semanaHoy: Periodo = { modo: 'semana', ancla: hoy };
  const r = rangoCompleto(semanaHoy);
  if (fechas.some((f) => enRango(f, r)) || fechas.length === 0) return semanaHoy;
  return { modo: 'semana', ancla: fechas.reduce((a, b) => (a > b ? a : b)) };
}

const partes = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  return { anio: a, mes: MESES[m - 1]!, dia: d };
};

/** «Jue 22» */
export const etiquetaDiaCorta = (iso: string) => `${DIAS[diaSemana(iso)]} ${partes(iso).dia}`;

/** «Jue 22 oct 2026» */
export function etiquetaDia(iso: string): string {
  const p = partes(iso);
  return `${DIAS[diaSemana(iso)]} ${p.dia} ${p.mes} ${p.anio}`;
}

/** «Lun 19 – Vie 23 oct 2026» (con mes o año distinto al cruzar) */
export function etiquetaSemana(r: Rango): string {
  const a = partes(r.desde);
  const b = partes(r.hasta);
  const ini = `${DIAS[diaSemana(r.desde)]} ${a.dia}`;
  const fin = `${DIAS[diaSemana(r.hasta)]} ${b.dia} ${b.mes} ${b.anio}`;
  if (a.anio !== b.anio) return `${ini} ${a.mes} ${a.anio} – ${fin}`;
  if (a.mes !== b.mes) return `${ini} ${a.mes} – ${fin}`;
  return `${ini} – ${fin}`;
}

export const etiquetaPeriodo = (p: Periodo) =>
  p.modo === 'semana' ? etiquetaSemana(rangoPeriodo(p)) : etiquetaDia(p.ancla);

/** Fecha local de hoy como AAAA-MM-DD. */
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const largo = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  return { dia: DIAS_LARGOS[diaSemana(iso)]!, d, mes: MESES_LARGOS[m - 1]!, anio: a };
};

/** «Lunes 19 – viernes 23 de octubre de 2026»; un solo día: «Jueves 22 de octubre de 2026». */
export function etiquetaLarga(r: Rango): string {
  const a = largo(r.desde);
  const b = largo(r.hasta);
  if (r.desde === r.hasta) return capital(`${a.dia} ${a.d} de ${a.mes} de ${a.anio}`);
  const ini = a.anio !== b.anio ? `${a.dia} ${a.d} de ${a.mes} de ${a.anio}` : a.mes !== b.mes ? `${a.dia} ${a.d} de ${a.mes}` : `${a.dia} ${a.d}`;
  return capital(`${ini} – ${b.dia} ${b.d} de ${b.mes} de ${b.anio}`);
}

/** true si el rango es exactamente una semana lun–vie. */
export const esSemanaLV = (r: Rango) => r.desde === lunesDe(r.desde) && r.hasta === sumarDias(r.desde, 4);
