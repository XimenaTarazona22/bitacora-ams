// Almacén clave-valor mínimo sobre IndexedDB (handle del archivo, luego configuración y logo).
const BD = 'bitacora-ams';
const ALMACEN = 'kv';

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(ALMACEN);
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rechazar(req.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, f: (a: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const bd = await abrir();
  try {
    return await new Promise<T>((resolver, rechazar) => {
      const req = f(bd.transaction(ALMACEN, modo).objectStore(ALMACEN));
      req.onsuccess = () => resolver(req.result);
      req.onerror = () => rechazar(req.error);
    });
  } finally {
    bd.close();
  }
}

export const guardar = (clave: string, valor: unknown) => operar('readwrite', (a) => a.put(valor, clave));
export const leer = <T>(clave: string) => operar<T | undefined>('readonly', (a) => a.get(clave));
export const borrar = (clave: string) => operar('readwrite', (a) => a.delete(clave));
