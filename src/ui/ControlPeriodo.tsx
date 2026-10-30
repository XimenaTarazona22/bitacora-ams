import { type Periodo, esFinDeSemana, etiquetaPeriodo, lunesDe, moverPeriodo, rangoPeriodo, semanaLV } from '../dominio/periodos';

/** Selector Diario | Semanal | Rango y navegación del periodo, compartido por Tablero y Registros a revisar. */
export function ControlPeriodo({ periodo, onPeriodo }: { periodo: Periodo; onPeriodo: (p: Periodo) => void }) {
  const { modo } = periodo;
  const r = rangoPeriodo(periodo);
  return (
    <>
      <div className="segmentado" role="group" aria-label="Vista">
        <button
          aria-pressed={modo === 'dia'}
          onClick={() => onPeriodo({ modo: 'dia', ancla: esFinDeSemana(r.desde) ? lunesDe(r.desde) : r.desde })}
        >
          Diario
        </button>
        <button aria-pressed={modo === 'semana'} onClick={() => onPeriodo({ modo: 'semana', ancla: r.desde })}>Semanal</button>
        <button
          aria-pressed={modo === 'rango'}
          onClick={() => {
            // Parte del periodo que se está viendo: la semana o el día actual.
            const base = modo === 'semana' ? semanaLV(periodo.ancla) : r;
            onPeriodo({ modo: 'rango', ancla: base.desde, hasta: base.hasta });
          }}
        >
          Rango
        </button>
      </div>
      {modo === 'rango' ? (
        <div className="periodo" role="group" aria-label="Rango de fechas">
          <button aria-label="Periodo anterior" onClick={() => onPeriodo(moverPeriodo(periodo, -1))}>‹</button>
          <label className="fecha-rango">
            <span>Desde</span>
            <input
              type="date" value={r.desde}
              onChange={(e) => e.target.value && onPeriodo({ modo: 'rango', ancla: e.target.value, hasta: e.target.value > r.hasta ? e.target.value : r.hasta })}
            />
          </label>
          <label className="fecha-rango">
            <span>Hasta</span>
            <input
              type="date" value={r.hasta} min={r.desde}
              onChange={(e) => e.target.value && onPeriodo({ modo: 'rango', ancla: e.target.value < r.desde ? e.target.value : r.desde, hasta: e.target.value })}
            />
          </label>
          <button aria-label="Periodo siguiente" onClick={() => onPeriodo(moverPeriodo(periodo, 1))}>›</button>
        </div>
      ) : (
        <div className="periodo">
          <button aria-label={modo === 'dia' ? 'Día anterior' : 'Semana anterior'} onClick={() => onPeriodo(moverPeriodo(periodo, -1))}>‹</button>
          <span className="etiqueta" aria-live="polite">{etiquetaPeriodo(periodo)}</span>
          <button aria-label={modo === 'dia' ? 'Día siguiente' : 'Semana siguiente'} onClick={() => onPeriodo(moverPeriodo(periodo, 1))}>›</button>
        </div>
      )}
    </>
  );
}
