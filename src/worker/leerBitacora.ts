import { leerControl } from '../dominio/control';
import { leerLibro } from '../dominio/leerLibro';

export type MensajeEntrada = { tipo?: 'bitacora' | 'control'; datos: ArrayBuffer };
export type MensajeSalida =
  | { ok: true; resultado: ReturnType<typeof leerLibro> | ReturnType<typeof leerControl> }
  | { ok: false; error: string };

self.onmessage = (e: MessageEvent<MensajeEntrada>) => {
  try {
    const resultado = e.data.tipo === 'control' ? leerControl(e.data.datos) : leerLibro(e.data.datos);
    const salida: MensajeSalida = { ok: true, resultado };
    self.postMessage(salida);
  } catch (err) {
    const salida: MensajeSalida = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(salida);
  }
};
