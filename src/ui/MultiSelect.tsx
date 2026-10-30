interface Props {
  etiqueta: string;
  opciones: string[];
  seleccion: string[];
  onCambio: (s: string[]) => void;
}

/** Lista desplegable con casillas. Selección vacía = todos. */
export function MultiSelect({ etiqueta, opciones, seleccion, onCambio }: Props) {
  const alternar = (o: string) =>
    onCambio(seleccion.includes(o) ? seleccion.filter((x) => x !== o) : [...seleccion, o]);
  return (
    <details className="multi">
      <summary>
        {etiqueta}: {seleccion.length === 0 ? 'Todos' : seleccion.length === 1 ? seleccion[0] : `${seleccion.length} seleccionados`}
      </summary>
      <div className="panel">
        <button className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={() => onCambio([])} disabled={seleccion.length === 0}>
          Mostrar todos
        </button>
        {opciones.map((o) => (
          <label key={o}>
            <input type="checkbox" checked={seleccion.includes(o)} onChange={() => alternar(o)} />
            {o}
          </label>
        ))}
      </div>
    </details>
  );
}
