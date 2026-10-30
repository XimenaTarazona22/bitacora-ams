import { type Periodo, esFinDeSemana, etiquetaPeriodo, lunesDe, moverPeriodo } from '../dominio/periodos';

/** Selector Diario | Semanal y navegación del periodo, compartido por Tablero y Registros a revisar. */
export function ControlPeriodo({ periodo, onPeriodo }: { periodo: Periodo; onPeriodo: (p: Periodo) => void }) {
  const esDia = periodo.modo === 'dia';
  return (
    <>
      <div className="segmentado" role="group" aria-label="Vista">
        <button
          aria-pressed={esDia}
          onClick={() => onPeriodo({ modo: 'dia', ancla: esFinDeSemana(periodo.ancla) ? lunesDe(periodo.ancla) : periodo.ancla })}
        >
          Diario
        </button>
        <button aria-pressed={!esDia} onClick={() => onPeriodo({ modo: 'semana', ancla: periodo.ancla })}>Semanal</button>
      </div>
      <div className="periodo">
        <button aria-label={esDia ? 'Día anterior' : 'Semana anterior'} onClick={() => onPeriodo(moverPeriodo(periodo, -1))}>‹</button>
        <span className="etiqueta" aria-live="polite">{etiquetaPeriodo(periodo)}</span>
        <button aria-label={esDia ? 'Día siguiente' : 'Semana siguiente'} onClick={() => onPeriodo(moverPeriodo(periodo, 1))}>›</button>
      </div>
    </>
  );
}
