import { CLAVE_BITACORA, CLAVE_CONTROL, validarControl, validarResultado } from '../almacenamiento/archivo';
import { leerControlEnWorker, leerEnWorker } from './lector';
import { type EstadoFuente, useFuente } from './useFuente';

export type EstadoBitacora = EstadoFuente;

const leerBitacora = async (datos: ArrayBuffer) => validarResultado(await leerEnWorker(datos));
const leerControl = async (datos: ArrayBuffer) => validarControl(await leerControlEnWorker(datos));

/** Bitácora de horas (Bitácora Servicios AMS). */
export const useBitacora = () => useFuente(CLAVE_BITACORA, leerBitacora);

/** Control seguimiento AMS: solo se usa el caso y la tecnología. Opcional. */
export const useControl = () => useFuente(CLAVE_CONTROL, leerControl);
