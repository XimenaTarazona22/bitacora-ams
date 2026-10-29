import * as XLSX from 'xlsx';
import { esHojaConsultor, filaARegistro, mapearColumnas } from './normalizar';
import type { Registro, ResultadoLectura } from './tipos';

/** Lee el libro completo (solo lectura) y devuelve los registros normalizados. */
export function leerLibro(datos: ArrayBuffer | Uint8Array): ResultadoLectura {
  // Sin cellDates: los seriales numéricos evitan desfases de zona horaria.
  const libro = XLSX.read(datos, { type: 'array' });
  const registros: Registro[] = [];
  const hojasConsultor: string[] = [];
  const hojasIgnoradas: string[] = [];

  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre];
    if (!hoja) continue;
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: null });
    const encabezado = filas[0] ?? [];
    if (!esHojaConsultor(encabezado)) {
      hojasIgnoradas.push(nombre);
      continue;
    }
    hojasConsultor.push(nombre);
    const mapa = mapearColumnas(encabezado);
    for (let i = 1; i < filas.length; i++) {
      const r = filaARegistro(filas[i] ?? [], mapa, nombre, i + 1);
      if (r) registros.push(r);
    }
  }
  return { registros, hojasConsultor, hojasIgnoradas };
}
