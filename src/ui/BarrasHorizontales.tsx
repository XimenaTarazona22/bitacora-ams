import type { Barra } from '../dominio/agregaciones';
import { formatearHoras } from '../dominio/formato';

export function BarrasHorizontales({ datos, formato }: { datos: Barra[]; formato: 'decimal' | 'hm' }) {
  if (datos.length === 0) return <p className="vacio">Sin datos en este periodo.</p>;
  const max = Math.max(...datos.map((d) => d.horas));
  return (
    <div role="list">
      {datos.map((d) => (
        <div className="barra-fila" role="listitem" key={d.nombre}>
          <span className="nombre" title={d.nombre}>{d.nombre}</span>
          <span className="pista" aria-hidden="true">
            <span className="relleno" style={{ display: 'block', width: `${max > 0 ? (d.horas / max) * 100 : 0}%` }} />
          </span>
          <span className="num">{formatearHoras(d.horas, formato)}</span>
        </div>
      ))}
    </div>
  );
}
