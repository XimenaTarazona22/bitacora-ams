// ?worker&inline: el worker queda dentro del HTML (funciona desde file://)
import LectorWorker from '../worker/leerBitacora?worker&inline';
import type { MensajeSalida } from '../worker/leerBitacora';
import type { ResultadoControl } from '../dominio/control';
import type { ResultadoLectura } from '../dominio/tipos';

function enWorker<T>(tipo: 'bitacora' | 'control', datos: ArrayBuffer): Promise<T> {
  return new Promise((resolver, rechazar) => {
    const w = new LectorWorker();
    w.onmessage = (e: MessageEvent<MensajeSalida>) => {
      w.terminate();
      if (e.data.ok) resolver(e.data.resultado as T);
      else rechazar(new Error(e.data.error));
    };
    w.onerror = (e) => {
      w.terminate();
      rechazar(new Error(e.message));
    };
    w.postMessage({ tipo, datos }, [datos]);
  });
}

export const leerEnWorker = (datos: ArrayBuffer) => enWorker<ResultadoLectura>('bitacora', datos);
export const leerControlEnWorker = (datos: ArrayBuffer) => enWorker<ResultadoControl>('control', datos);
