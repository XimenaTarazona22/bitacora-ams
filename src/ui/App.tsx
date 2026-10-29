import { useState } from 'react';
// ?worker&inline: el worker queda dentro del HTML (funciona desde file://)
import LectorWorker from '../worker/leerBitacora?worker&inline';
import type { MensajeSalida } from '../worker/leerBitacora';
import type { ResultadoLectura } from '../dominio/tipos';

function leerEnWorker(datos: ArrayBuffer): Promise<ResultadoLectura> {
  return new Promise((resolver, rechazar) => {
    const w = new LectorWorker();
    w.onmessage = (e: MessageEvent<MensajeSalida>) => {
      w.terminate();
      if (e.data.ok) resolver(e.data.resultado);
      else rechazar(new Error(e.data.error));
    };
    w.onerror = (e) => {
      w.terminate();
      rechazar(new Error(e.message));
    };
    w.postMessage({ datos }, [datos]);
  });
}

export function App() {
  const [resultado, setResultado] = useState<ResultadoLectura | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return;
    setError('');
    setCargando(true);
    try {
      setResultado(await leerEnWorker(await archivo.arrayBuffer()));
    } catch (e) {
      setResultado(null);
      setError(`No se pudo leer el archivo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '48px auto', padding: 16 }}>
      <h1>Bitácora AMS · Informes de horas</h1>
      <label>
        Elige la bitácora (.xlsx){' '}
        <input type="file" accept=".xlsx,.xlsm" onChange={(e) => alElegir(e.target.files?.[0])} />
      </label>
      {cargando && <p>Leyendo…</p>}
      {error && <p role="alert">{error}</p>}
      {resultado && (
        <p>
          {resultado.hojasConsultor.length} hojas de consultor, {resultado.registros.length} registros
        </p>
      )}
    </main>
  );
}
