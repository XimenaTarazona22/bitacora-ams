import { etiquetaDia } from './periodos';
import { type Alertas, type JornadaLarga, ETIQUETA_ALERTA } from './reglas';
import type { ReglaId, Registro } from './tipos';

export const ETIQUETA_REGLA: Record<ReglaId, string> = { ...ETIQUETA_ALERTA, jornadaLarga: 'Jornada larga' };

export const ORDEN_REGLAS: ReglaId[] = [
  'sinCaso', 'sinEstado', 'sinActividades', 'casoNoReconocido', 'sinTecnologia', 'finDeSemana',
  'jornadaLarga', 'horasInvalidas', 'franjaCruzada', 'sinFecha',
];

export interface FilaRevision {
  registro: Registro;
  /** Alertas del registro; 'jornadaLarga' solo informa, no cuenta como registro a revisar. */
  tipos: ReglaId[];
}

const claveDia = (consultor: string, fecha: string) => `${consultor}|${fecha}`;

/** Registros con alguna alerta (de registro o de jornada larga). */
export function filasRevision(regs: Registro[], alertas: Alertas, largas: JornadaLarga[]): FilaRevision[] {
  const dias = new Set(largas.map((j) => claveDia(j.consultor, j.fecha)));
  const filas: FilaRevision[] = [];
  for (const r of regs) {
    const tipos: ReglaId[] = [...(alertas.get(r) ?? [])];
    if (r.fecha && dias.has(claveDia(r.consultor, r.fecha))) tipos.push('jornadaLarga');
    if (tipos.length) filas.push({ registro: r, tipos });
  }
  return filas;
}

/** Registros por tipo; la jornada larga cuenta consultor-días. */
export function conteosPorTipo(filas: FilaRevision[]): Record<ReglaId, number> {
  const c = Object.fromEntries(ORDEN_REGLAS.map((t) => [t, 0])) as Record<ReglaId, number>;
  const dias = new Set<string>();
  for (const f of filas) {
    for (const t of f.tipos) {
      if (t === 'jornadaLarga') dias.add(claveDia(f.registro.consultor, f.registro.fecha ?? ''));
      else c[t]++;
    }
  }
  c.jornadaLarga = dias.size;
  return c;
}

/** Sin filtros: los registros con alertas propias. Con filtros: los que tengan alguno de esos tipos. */
export function aplicarFiltros(filas: FilaRevision[], activos: ReglaId[]): FilaRevision[] {
  return activos.length === 0
    ? filas.filter((f) => f.tipos.some((t) => t !== 'jornadaLarga'))
    : filas.filter((f) => f.tipos.some((t) => activos.includes(t)));
}

export const textoQueFalta = (f: FilaRevision) => f.tipos.map((t) => ETIQUETA_REGLA[t]).join(', ');

/** Texto listo para pegar en un correo o en Teams, agrupado por consultor. */
export function textoPorConsultor(filas: FilaRevision[], periodo: string): string {
  const grupos = new Map<string, FilaRevision[]>();
  for (const f of filas) grupos.set(f.registro.consultor, [...(grupos.get(f.registro.consultor) ?? []), f]);
  const bloques = [...grupos]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([consultor, fs]) => {
      const lineas = fs
        .sort((a, b) => (a.registro.fecha ?? '').localeCompare(b.registro.fecha ?? '') || a.registro.fila - b.registro.fila)
        .map(({ registro: r, tipos }) => {
          const partes = [
            `Hoja ${r.hoja}, fila ${r.fila}`,
            r.fecha ? etiquetaDia(r.fecha) : 'sin fecha',
            r.cliente || 'sin cliente',
            `caso: ${r.casoOriginal || 'vacío'}`,
            `por revisar: ${tipos.map((t) => ETIQUETA_REGLA[t].toLowerCase()).join(', ')}`,
          ];
          return `• ${partes.join(' · ')}`;
        });
      return `${consultor} (${fs.length} ${fs.length === 1 ? 'registro' : 'registros'})\n${lineas.join('\n')}`;
    });
  return `Registros de la bitácora por revisar · ${periodo}\n\n${bloques.join('\n\n')}`;
}
