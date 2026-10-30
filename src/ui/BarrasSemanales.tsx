import type { SemanaHoras } from '../dominio/casos';
import { formatearHoras } from '../dominio/formato';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const etiqueta = (iso: string) => `${Number(iso.slice(8))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;

const ANCHO = 56;
const ALTO = 170;
const BASE = 30; // espacio inferior para las etiquetas
const TOPE = 22; // espacio superior para el valor

/** Horas por semana (lun–vie en azul; fin de semana apilado en naranja). */
export function BarrasSemanales({ semanas, formato }: { semanas: SemanaHoras[]; formato: 'decimal' | 'hm' }) {
  if (semanas.length === 0) return <p className="vacio">Sin registros con fecha.</p>;
  const max = Math.max(...semanas.map((s) => s.horas + s.finDeSemana), 1);
  const util = ALTO - BASE - TOPE;
  const resumen = semanas.map((s) => `semana del ${etiqueta(s.lunes)}: ${formatearHoras(s.horas + s.finDeSemana, formato)}`).join('; ');
  return (
    <div className="envoltura">
      <svg role="img" aria-label={`Horas por semana. ${resumen}`} width={semanas.length * ANCHO + 8} height={ALTO} style={{ display: 'block' }}>
        {semanas.map((s, i) => {
          const hLV = (s.horas / max) * util;
          const hFS = (s.finDeSemana / max) * util;
          const x = i * ANCHO + 8;
          const total = s.horas + s.finDeSemana;
          return (
            <g key={s.lunes}>
              <rect x={x} y={ALTO - BASE - hLV} width={ANCHO - 16} height={hLV} rx={3} fill="#1f5fbf" />
              {hFS > 0 && <rect x={x} y={ALTO - BASE - hLV - hFS} width={ANCHO - 16} height={hFS} rx={3} fill="#f59e0b" />}
              {total > 0 && (
                <text x={x + (ANCHO - 16) / 2} y={ALTO - BASE - hLV - hFS - 5} textAnchor="middle" fontSize="11" fill="#1c2333">
                  {formatearHoras(total, formato).replace(' h', '')}
                </text>
              )}
              <text x={x + (ANCHO - 16) / 2} y={ALTO - 10} textAnchor="middle" fontSize="11" fill="#5a6477">{etiqueta(s.lunes)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
