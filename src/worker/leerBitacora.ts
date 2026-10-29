import { leerLibro } from '../dominio/leerLibro';

export type MensajeEntrada = { datos: ArrayBuffer };
export type MensajeSalida =
  | { ok: true; resultado: ReturnType<typeof leerLibro> }
  | { ok: false; error: string };

self.onmessage = (e: MessageEvent<MensajeEntrada>) => {
  try {
    const salida: MensajeSalida = { ok: true, resultado: leerLibro(e.data.datos) };
    self.postMessage(salida);
  } catch (err) {
    const salida: MensajeSalida = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(salida);
  }
};
