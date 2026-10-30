import type { ClaseCaso, ConfigCasos, Registro } from './tipos';

export const CONFIG_CASOS_DEFECTO: ConfigCasos = {
  sinCaso: ['0', 'SIN CASO', 'SINCASO', 'SIN-CASO', 'N/A', 'NA', '-'],
  patrones: [
    '^\\d+$',
    '^(TASK|PRB|INC|RITM|REQ|CHG|SCTASK|SP)\\d+$',
    '^[A-Z]{2,6}-[A-Z]{2,6}-\\d+$',
  ],
  listaBlanca: [],
};

/** Minúsculas, sin tildes ni signos, espacios colapsados. */
export function normalizarEncabezado(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type CampoBitacora =
  | 'fecha' | 'cliente' | 'consultor' | 'tipo' | 'caso' | 'titulo' | 'apoyo'
  | 'estado' | 'horaInicio' | 'horaFin' | 'tiempo' | 'clasificacion'
  | 'contratoAnterior' | 'actividades';

const SINONIMOS: Record<CampoBitacora, string[]> = {
  fecha: ['fecha'],
  cliente: ['cliente'],
  consultor: ['consultor'],
  tipo: ['tipo'],
  caso: ['caso', 'no caso', 'n caso', 'nro caso', 'numero de caso', 'numero caso', 'num caso'],
  titulo: ['titulo del caso', 'titulo'],
  apoyo: ['consultor de apoyo', 'apoyo'],
  estado: ['estado'],
  horaInicio: ['hora inicio', 'hora de inicio'],
  horaFin: ['hora fin', 'hora final', 'hora de fin'],
  tiempo: ['tiempo invertido', 'tiempo'],
  clasificacion: ['clasificacion hora', 'clasificacion'],
  contratoAnterior: ['contrato anterior'],
  actividades: ['actividades realizadas', 'actividades'],
};

export type MapaColumnas = Partial<Record<CampoBitacora, number>>;

/** Índice de columna por campo, según el texto del encabezado. */
export function mapearColumnas(encabezado: unknown[]): MapaColumnas {
  const mapa: MapaColumnas = {};
  const normalizados = encabezado.map(normalizarEncabezado);
  for (const campo of Object.keys(SINONIMOS) as CampoBitacora[]) {
    const i = normalizados.findIndex((h) => SINONIMOS[campo].includes(h));
    if (i >= 0) mapa[campo] = i;
  }
  return mapa;
}

/** Una hoja es de consultor si su encabezado empieza por Fecha y trae cliente y caso. */
export function esHojaConsultor(encabezado: unknown[]): boolean {
  const m = mapearColumnas(encabezado);
  return normalizarEncabezado(encabezado[0]) === 'fecha' && m.cliente !== undefined && m.caso !== undefined;
}

export function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function texto(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/** Serial de Excel → AAAA-MM-DD. Acepta también texto ISO. */
export function serialAFecha(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    const d = new Date(Math.round((Math.floor(v) - 25569) * 864e5));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

/** Fracción de día de Excel → horas decimales. */
export function fraccionAHoras(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? redondear2((v % 1) * 24) : null;
}

/** Caso → texto normalizado: sin espacios sobrantes, códigos en mayúsculas, números sin decimales. */
export function normalizarCaso(v: unknown): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.trunc(v)) : '';
  const t = texto(v).replace(/\s+/g, ' ');
  if (/^\d+\.0+$/.test(t)) return t.replace(/\.0+$/, '');
  return /^[A-Za-z0-9-]+$/.test(t) ? t.toUpperCase() : t;
}

export function clasificarCaso(caso: string, cfg: ConfigCasos = CONFIG_CASOS_DEFECTO): ClaseCaso {
  const c = caso.toUpperCase();
  if (c === '') return 'sin_caso'; // el caso vacío siempre es «sin caso»
  if (cfg.sinCaso.some((s) => s.toUpperCase() === c)) return 'sin_caso';
  if (cfg.patrones.some((p) => new RegExp(p, 'i').test(caso))) return 'valido';
  if (cfg.listaBlanca.some((n) => n.toUpperCase() === c)) return 'valido';
  return 'no_reconocido';
}

/** Convierte una fila cruda en Registro; null si está totalmente vacía. */
export function filaARegistro(
  fila: unknown[],
  mapa: MapaColumnas,
  hoja: string,
  numeroFila: number,
): Registro | null {
  const celda = (c: CampoBitacora): unknown => (mapa[c] === undefined ? null : fila[mapa[c]!]);
  const t = (c: CampoBitacora) => texto(celda(c));

  const vacia = (Object.keys(mapa) as CampoBitacora[]).every((c) => t(c) === '');
  if (vacia) return null;

  const horaInicio = fraccionAHoras(celda('horaInicio'));
  const horaFin = fraccionAHoras(celda('horaFin'));
  const tiempo = celda('tiempo');
  let horas: number;
  let horasCalculadas = false;
  if (typeof tiempo === 'number' && Number.isFinite(tiempo)) {
    horas = redondear2(tiempo);
  } else {
    horasCalculadas = true;
    horas = horaInicio !== null && horaFin !== null ? redondear2(horaFin - horaInicio) : 0;
  }

  return {
    hoja,
    fila: numeroFila,
    fecha: serialAFecha(celda('fecha')),
    cliente: t('cliente').replace(/\s+/g, ' '),
    consultor: t('consultor') || hoja,
    tipo: t('tipo'),
    caso: normalizarCaso(celda('caso')),
    casoOriginal: t('caso'),
    titulo: t('titulo'),
    apoyo: t('apoyo'),
    estado: t('estado'),
    horaInicio,
    horaFin,
    horas,
    horasCalculadas,
    clasificacion: t('clasificacion'),
    tecnologia: '',
    contratoAnterior: t('contratoAnterior'),
    actividades: t('actividades'),
  };
}
