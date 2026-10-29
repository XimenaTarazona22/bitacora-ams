// ?worker&inline: el worker queda dentro del HTML (funciona desde file://)
import LectorWorker from '../worker/leerBitacora?worker&inline';
import type { MensajeSalida } from '../worker/leerBitacora';
import type { ResultadoLectura } from '../dominio/tipos';

export function leerEnWorker(datos: ArrayBuffer): Promise<ResultadoLectura> {
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
