import type { ResultadoLectura } from '../dominio/tipos';
import { borrar, guardar, leer } from './db';

/** FileSystemFileHandle con los métodos de permisos (aún fuera de lib.dom). */
export interface HandleArchivo extends FileSystemFileHandle {
  queryPermission(d: { mode: 'read' }): Promise<PermissionState>;
  requestPermission(d: { mode: 'read' }): Promise<PermissionState>;
}

type SelectorArchivos = (o: {
  multiple: boolean;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<HandleArchivo[]>;

const CLAVE_HANDLE = 'handle-bitacora';

export const soportaFSA = () => typeof window !== 'undefined' && 'showOpenFilePicker' in window;

/** Error con un mensaje ya listo para mostrar a la persona usuaria. */
export class ErrorBitacora extends Error {}

/** Abre el selector (solo lectura) y recuerda el archivo elegido. */
export async function elegirArchivo(): Promise<{ handle: HandleArchivo; recordado: boolean }> {
  const selector = (window as unknown as { showOpenFilePicker: SelectorArchivos }).showOpenFilePicker;
  const [handle] = await selector.call(window, {
    multiple: false,
    types: [{ description: 'Libro de Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xlsm'] } }],
  });
  if (!handle) throw new ErrorBitacora('No se eligió ningún archivo.');
  let recordado = true;
  try {
    await guardar(CLAVE_HANDLE, handle);
  } catch {
    recordado = false; // p. ej. IndexedDB bloqueado al abrir desde file://
  }
  return { handle, recordado };
}

export async function cargarHandleGuardado(): Promise<HandleArchivo | null> {
  try {
    return (await leer<HandleArchivo>(CLAVE_HANDLE)) ?? null;
  } catch {
    return null;
  }
}

export const olvidarHandle = () => borrar(CLAVE_HANDLE).catch(() => undefined);

export const permisoConcedido = async (h: HandleArchivo) => (await h.queryPermission({ mode: 'read' })) === 'granted';

export async function pedirPermiso(h: HandleArchivo): Promise<boolean> {
  return (await h.requestPermission({ mode: 'read' })) === 'granted';
}

export function validarResultado(r: ResultadoLectura): ResultadoLectura {
  if (r.hojasConsultor.length === 0) {
    throw new ErrorBitacora(
      'El archivo no tiene ninguna hoja de consultor (hoja cuyo encabezado empiece por «Fecha» y tenga Cliente y Caso). ¿Es la bitácora correcta?',
    );
  }
  return r;
}

/** Traduce cualquier fallo de lectura a un mensaje claro con la causa probable. */
export function mensajeError(e: unknown): string {
  if (e instanceof ErrorBitacora) return e.message;
  const nombre = e instanceof Error ? e.name : '';
  switch (nombre) {
    case 'NotFoundError':
      return 'No se encontró el archivo. Puede haberse movido, renombrado o borrado. Elígelo de nuevo.';
    case 'NotAllowedError':
    case 'SecurityError':
      return 'El navegador no tiene permiso para leer el archivo. Pulsa «Conectar con la bitácora» o elígelo de nuevo.';
    case 'NotReadableError':
      return 'No se pudo leer el archivo. Causas probables: está bloqueado por otro programa o OneDrive lo tiene solo en la nube. Haz clic derecho sobre él en el Explorador y marca «Mantener siempre en este dispositivo».';
    default: {
      const detalle = e instanceof Error ? ` Detalle técnico: ${e.message}` : '';
      return `No se pudo interpretar el archivo. Verifica que sea un libro de Excel (.xlsx) válido y no esté dañado.${detalle}`;
    }
  }
}

/** «Datos leídos hoy 3:05 p. m. · 1.258 registros» */
export function textoLectura(cuando: Date, registros: number, ahora = new Date()): string {
  const hora = cuando.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
  const mismoDia = cuando.toDateString() === ahora.toDateString();
  const dia = mismoDia ? 'hoy' : cuando.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  return `Datos leídos ${dia} ${hora} · ${registros.toLocaleString('es-CO')} registros`;
}
