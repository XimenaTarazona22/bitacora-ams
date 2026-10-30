import { type ConfigApp, fusionarConfig } from '../dominio/config';
import { guardar, leer } from './db';

const CLAVE_CONFIG = 'config';
const CLAVE_LOGO = 'logo';
const MAX_LOGO = 1024 * 1024;

export const cargarConfig = async (): Promise<ConfigApp> => fusionarConfig(await leer<unknown>(CLAVE_CONFIG).catch(() => undefined));
export const guardarConfig = (c: ConfigApp) => guardar(CLAVE_CONFIG, c).catch(() => undefined);

/** Logo como data URL (PNG o JPG), guardado solo en este navegador. */
export const cargarLogo = () => leer<string>(CLAVE_LOGO).catch(() => undefined).then((l) => l ?? null);
export const guardarLogo = (l: string | null) => guardar(CLAVE_LOGO, l).catch(() => undefined);

export function leerLogo(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    if (!/^image\/(png|jpeg)$/.test(archivo.type)) return rechazar(new Error('El logo debe ser una imagen PNG o JPG.'));
    if (archivo.size > MAX_LOGO) return rechazar(new Error('El logo pesa más de 1 MB. Usa una imagen más liviana.'));
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
    lector.readAsDataURL(archivo);
  });
}

export interface ConfigExportada {
  version: 1;
  config: ConfigApp;
  logo: string | null;
}

export const serializarConfig = (config: ConfigApp, logo: string | null) =>
  JSON.stringify({ version: 1, config, logo } satisfies ConfigExportada, null, 2);

/** Interpreta un JSON exportado antes; acepta también la configuración suelta. */
export function interpretarConfig(texto: string): { config: ConfigApp; logo: string | null } {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (typeof datos !== 'object' || datos === null) throw new Error('El archivo no tiene una configuración de Bitácora AMS.');
  const d = datos as Record<string, unknown>;
  const envuelto = 'config' in d;
  const logo = envuelto && typeof d.logo === 'string' && /^data:image\/(png|jpeg);base64,/.test(d.logo) ? d.logo : null;
  return { config: fusionarConfig(envuelto ? d.config : d), logo };
}
