import { guardar, leer } from './db';

const CLAVE = 'resumenes-editados';

/** Resúmenes editados por la persona usuaria, por cliente, caso y periodo (ver claveResumen). */
export const cargarResumenes = async (): Promise<Record<string, string>> => (await leer<Record<string, string>>(CLAVE).catch(() => undefined)) ?? {};
export const guardarResumenes = (r: Record<string, string>) => guardar(CLAVE, r).catch(() => undefined);
