import { enRango, type Rango } from './periodos';
import type { Registro } from './tipos';

// Saludos, despedidas y firmas de correo que no aportan al resumen.
const SALUDO = /^(hola|buen[oa]s?\s*(d[ií]as?|tardes?|noches?)|estimad[oa]s?|cordial\s+saludo|feliz\s+d[ií]a)\b/i;
const CIERRE = /^(saludos?|cordialmente|atentamente|quedo\s+atent[oa]|quedamos\s+atent[oa]s?|gracias|muchas\s+gracias|cordial\s+saludo|de\s+antemano)\b/i;
// Inicio de un correo reenviado o citado: de ahí en adelante es el hilo, no la actividad.
const HILO = /^(de|from|enviado(\s+el)?|sent|para|to|asunto|subject|-{2,}\s*original)\s*:|^-{3,}|^_{3,}|^>/i;

/** Quita saludos, firmas e hilos de correo y compacta los espacios. */
export function limpiarActividad(texto: string): string {
  const salida: string[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const l = linea.trim();
    if (!l) continue;
    if (HILO.test(l) || CIERRE.test(l)) break;
    if (SALUDO.test(l) && l.length < 60) continue;
    salida.push(l);
  }
  return salida.join(' ').replace(/\s+/g, ' ').trim();
}

const clave = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const porFecha = (a: Registro, b: Registro) => (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.fila - b.fila;

/** Actividades limpias, sin repetidos, en orden cronológico. */
export function actividadesUnicas(regs: Registro[]): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const r of [...regs].sort(porFecha)) {
    const a = limpiarActividad(r.actividades);
    const k = clave(a);
    if (k && !vistas.has(k)) {
      vistas.add(k);
      salida.push(a);
    }
  }
  return salida;
}

/** Une las actividades con « · » y recorta en límite de palabra. */
export function textoRepresentativo(actividades: string[], max = 300): string {
  const t = actividades.map((a) => a.replace(/[.\s]+$/, '')).join(' · ');
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(' '), max * 0.6))}…`;
}

export interface ResumenEstado {
  estado: string;
  desde: string | null;
  hasta: string | null;
  registros: number;
  horas: number;
  texto: string;
}

/** Resumen por estado, en el orden en que cada estado apareció por primera vez. */
export function resumenPorEstado(regs: Registro[], max = 300, rango?: Rango): ResumenEstado[] {
  const grupos = new Map<string, Registro[]>();
  for (const r of [...regs].sort(porFecha)) {
    if (rango && !(r.fecha && enRango(r.fecha, rango))) continue;
    grupos.set(r.estado, [...(grupos.get(r.estado) ?? []), r]);
  }
  return [...grupos].map(([estado, rs]) => {
    const fechas = rs.flatMap((r) => (r.fecha ? [r.fecha] : []));
    return {
      estado,
      desde: fechas[0] ?? null,
      hasta: fechas[fechas.length - 1] ?? null,
      registros: rs.length,
      horas: Math.round(rs.reduce((s, r) => s + r.horas, 0) * 100) / 100,
      texto: textoRepresentativo(actividadesUnicas(rs), max),
    };
  });
}
