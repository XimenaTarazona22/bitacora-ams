import * as XLSX from 'xlsx';
import { esHojaConsultor, filaARegistro, mapearColumnas, normalizarEncabezado } from './normalizar';
import type { Registro, ResultadoLectura } from './tipos';

/**
 * Hojas que se saltan sin leerlas: «Base de Datos» es un consolidado de todas las hojas de consultor
 * (leerla duplicaría las horas) y tiene cientos de miles de filas de relleno.
 */
export const HOJAS_EXCLUIDAS_FIJAS = ['Base de Datos'];

/**
 * Filas que se leen por hoja. Hay hojas con fórmulas copiadas hasta la fila 1.048.576 y solo unos cientos de
 * registros reales; leerlas enteras congela la carga. 60.000 filas son décadas de trabajo de un consultor.
 */
export const FILAS_MAXIMAS = 60_000;

/** Lee el libro (solo lectura) y devuelve los registros normalizados. */
export function leerLibro(datos: ArrayBuffer | Uint8Array, excluidas: string[] = HOJAS_EXCLUIDAS_FIJAS): ResultadoLectura {
  const clave = (n: string) => normalizarEncabezado(n);
  const fuera = new Set(excluidas.map(clave));

  // Primero solo los nombres de las hojas (barato); después se lee únicamente lo que interesa.
  const nombres = XLSX.read(datos, { type: 'array', bookSheets: true }).SheetNames;
  const aLeer = nombres.filter((n) => !fuera.has(clave(n)));
  // Sin cellDates: los seriales numéricos evitan desfases de zona horaria.
  const libro = XLSX.read(datos, { type: 'array', sheets: aLeer, sheetRows: FILAS_MAXIMAS });

  const registros: Registro[] = [];
  const hojas: { nombre: string; registros: number }[] = [];
  const hojasIgnoradas: string[] = [];
  const hojasTruncadas: string[] = [];

  for (const nombre of aLeer) {
    const hoja = libro.Sheets[nombre];
    if (!hoja) continue;
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: null });
    const encabezado = filas[0] ?? [];
    if (!esHojaConsultor(encabezado)) {
      hojasIgnoradas.push(nombre);
      continue;
    }
    const mapa = mapearColumnas(encabezado);
    let cuantos = 0;
    let ultimaFila = 0;
    for (let i = 1; i < filas.length; i++) {
      const r = filaARegistro(filas[i] ?? [], mapa, nombre, i + 1);
      if (r) {
        registros.push(r);
        cuantos++;
        ultimaFila = i + 1;
      }
    }
    hojas.push({ nombre, registros: cuantos });
    // «!fullref» solo existe si SheetJS cortó la hoja; es un problema únicamente si había datos cerca del corte.
    if (hoja['!fullref'] && ultimaFila > FILAS_MAXIMAS - 500) hojasTruncadas.push(nombre);
  }

  return {
    registros,
    hojasConsultor: hojas.map((h) => h.nombre),
    hojas,
    hojasIgnoradas,
    hojasExcluidas: nombres.filter((n) => fuera.has(clave(n))),
    hojasTruncadas,
  };
}
