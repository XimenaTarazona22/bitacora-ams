import type { ConfigApp } from './config';
import { clasificarCaso } from './normalizar';
import { type Rango, enRango, esFinDeSemana } from './periodos';
import { redondear2 } from './normalizar';
import type { Registro, TipoAlerta } from './tipos';

export type Alertas = Map<Registro, TipoAlerta[]>;

export const ETIQUETA_ALERTA: Record<TipoAlerta, string> = {
  sinCaso: 'Sin número de caso',
  sinEstado: 'Sin estado',
  sinActividades: 'Sin actividades',
  casoNoReconocido: 'Caso no reconocido',
  finDeSemana: 'Fin de semana',
  horasInvalidas: 'Horas ≤ 0 o fin antes de inicio',
  franjaCruzada: 'Franja cruzada',
  sinFecha: 'Sin fecha',
};

const clave = (r: Registro) => `${r.consultor}|${r.fecha}`;

function franjaCruzada(a: Registro, b: Registro): boolean {
  const ok = (r: Registro) => r.horaInicio !== null && r.horaFin !== null && r.horaFin > r.horaInicio;
  return ok(a) && ok(b) && a.horaInicio! < b.horaFin! && b.horaInicio! < a.horaFin!;
}

/** Alertas por registro; solo incluye los registros con al menos una alerta activa. */
export function evaluarAlertas(registros: Registro[], cfg: ConfigApp): Alertas {
  const por = new Map<string, Registro[]>();
  for (const r of registros) {
    if (!r.fecha) continue;
    const k = clave(r);
    por.set(k, [...(por.get(k) ?? []), r]);
  }
  const cruzados = new Set<Registro>();
  for (const grupo of por.values()) {
    for (let i = 0; i < grupo.length; i++)
      for (let j = i + 1; j < grupo.length; j++)
        if (franjaCruzada(grupo[i]!, grupo[j]!)) cruzados.add(grupo[i]!).add(grupo[j]!);
  }

  const salida: Alertas = new Map();
  for (const r of registros) {
    const t: TipoAlerta[] = [];
    const clase = clasificarCaso(r.caso, cfg.casos);
    if (clase === 'sin_caso') t.push('sinCaso');
    if (clase === 'no_reconocido') t.push('casoNoReconocido');
    if (r.estado === '') t.push('sinEstado');
    if (r.actividades === '') t.push('sinActividades');
    if (r.fecha === null) t.push('sinFecha');
    else if (esFinDeSemana(r.fecha)) t.push('finDeSemana');
    const finAntes = r.horaInicio !== null && r.horaFin !== null && r.horaFin < r.horaInicio;
    if (r.horas <= 0 || finAntes) t.push('horasInvalidas');
    if (cruzados.has(r)) t.push('franjaCruzada');
    const activas = t.filter((x) => cfg.reglasActivas[x]);
    if (activas.length) salida.set(r, activas);
  }
  return salida;
}

export interface JornadaLarga {
  consultor: string;
  fecha: string;
  horas: number;
}

/** Consultor-día con horas ≥ umbral. */
export function jornadasLargas(registros: Registro[], umbral: number): JornadaLarga[] {
  const suma = new Map<string, JornadaLarga>();
  for (const r of registros) {
    if (!r.fecha) continue;
    const k = clave(r);
    const j = suma.get(k) ?? { consultor: r.consultor, fecha: r.fecha, horas: 0 };
    j.horas = redondear2(j.horas + r.horas);
    suma.set(k, j);
  }
  return [...suma.values()].filter((j) => j.horas >= umbral);
}

export interface ResumenRevision {
  total: number;
  habiles: number;
  finDeSemana: number;
}

/** Cuenta los registros con alertas dentro del rango (ya filtrados por cliente/consultor si aplica). */
export function resumenRevision(regs: Registro[], alertas: Alertas, rango: Rango): ResumenRevision {
  let habiles = 0;
  let finDeSemana = 0;
  for (const r of regs) {
    if (!r.fecha || !enRango(r.fecha, rango) || !alertas.has(r)) continue;
    if (esFinDeSemana(r.fecha)) finDeSemana++;
    else habiles++;
  }
  return { total: habiles + finDeSemana, habiles, finDeSemana };
}
