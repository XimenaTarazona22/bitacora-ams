import type { Registro } from './tipos';

/** Sustituye el nombre del cliente según el mapa de alias (sin distinguir mayúsculas). Sin alias, devuelve el mismo arreglo. */
export function aplicarAlias(registros: Registro[], alias: Record<string, string>): Registro[] {
  const mapa = new Map(Object.entries(alias).map(([k, v]) => [k.toLowerCase(), v]));
  if (mapa.size === 0) return registros;
  return registros.map((r) => {
    const nuevo = mapa.get(r.cliente.toLowerCase());
    return nuevo && nuevo !== r.cliente ? { ...r, cliente: nuevo } : r;
  });
}
