import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type HandleArchivo, cargarHandleGuardado, elegirArchivo, mensajeError, olvidarHandle,
  pedirPermiso, permisoConcedido, soportaFSA, validarResultado,
} from '../almacenamiento/archivo';
import type { ResultadoLectura } from '../dominio/tipos';
import { leerEnWorker } from './lector';

export type EstadoBitacora = 'iniciando' | 'sin_archivo' | 'requiere_permiso' | 'cargando' | 'listo';

/** Conexión con la bitácora: elegir, reconectar, actualizar. Nunca escribe en el archivo. */
export function useBitacora() {
  const [estado, setEstado] = useState<EstadoBitacora>('iniciando');
  const [nombre, setNombre] = useState('');
  const [resultado, setResultado] = useState<ResultadoLectura | null>(null);
  const [leidoEn, setLeidoEn] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const handle = useRef<HandleArchivo | null>(null);
  const hayDatos = useRef(false);

  const procesar = useCallback(async (archivo: File) => {
    setEstado('cargando');
    setError('');
    try {
      const r = validarResultado(await leerEnWorker(await archivo.arrayBuffer()));
      hayDatos.current = true;
      setResultado(r);
      setNombre(archivo.name);
      setLeidoEn(new Date());
      setEstado('listo');
    } catch (e) {
      setError(mensajeError(e));
      setEstado(hayDatos.current ? 'listo' : 'sin_archivo');
    }
  }, []);

  const leerHandle = useCallback(async (h: HandleArchivo) => {
    try {
      await procesar(await h.getFile());
    } catch (e) {
      setError(mensajeError(e));
      setEstado(hayDatos.current ? 'listo' : 'sin_archivo');
    }
  }, [procesar]);

  useEffect(() => {
    (async () => {
      if (!soportaFSA()) return setEstado('sin_archivo');
      const h = await cargarHandleGuardado();
      if (!h) return setEstado('sin_archivo');
      handle.current = h;
      setNombre(h.name);
      if (await permisoConcedido(h).catch(() => false)) await leerHandle(h);
      else setEstado('requiere_permiso');
    })();
  }, [leerHandle]);

  /** Selector de archivos (Edge/Chrome); recuerda el archivo para próximas aperturas. */
  const elegir = useCallback(async () => {
    setError('');
    setAviso('');
    try {
      const { handle: h, recordado } = await elegirArchivo();
      handle.current = h;
      if (!recordado) setAviso('Este navegador no permite recordar el archivo: tendrás que elegirlo cada vez que abras la app.');
      await leerHandle(h);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return; // canceló el selector
      setError(mensajeError(e));
    }
  }, [leerHandle]);

  /** Un clic tras reabrir la app: pide permiso de lectura y carga. */
  const conectar = useCallback(async () => {
    const h = handle.current;
    if (!h) return elegir();
    setError('');
    try {
      if (await pedirPermiso(h)) await leerHandle(h);
      else setError('No se concedió el permiso de lectura. Pulsa «Conectar con la bitácora» y elige «Permitir».');
    } catch (e) {
      setError(mensajeError(e));
    }
  }, [elegir, leerHandle]);

  /** Vuelve a leer el archivo. Sin handle (arrastrar/soltar) hay que elegirlo otra vez. */
  const actualizar = useCallback(async () => {
    if (handle.current) {
      setError('');
      if (await permisoConcedido(handle.current).catch(() => false)) await leerHandle(handle.current);
      else await conectar();
    } else if (soportaFSA()) {
      await elegir();
    } else {
      setAviso('Para actualizar, vuelve a elegir o a arrastrar el archivo.');
    }
  }, [conectar, elegir, leerHandle]);

  /** Archivo recibido por <input type="file"> o arrastrar y soltar: no se puede recordar. */
  const cargarArchivo = useCallback(async (archivo: File) => {
    handle.current = null;
    setAviso('Archivo cargado sin recordarlo: para actualizar, vuelve a elegirlo o arrastrarlo.');
    await procesar(archivo);
  }, [procesar]);

  const desconectar = useCallback(async () => {
    handle.current = null;
    hayDatos.current = false;
    await olvidarHandle();
    setResultado(null);
    setNombre('');
    setLeidoEn(null);
    setError('');
    setAviso('');
    setEstado('sin_archivo');
  }, []);

  return { estado, nombre, resultado, leidoEn, error, aviso, elegir, conectar, actualizar, cargarArchivo, desconectar };
}
