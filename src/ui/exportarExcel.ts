import * as XLSX from 'xlsx';

/** Descarga un .xlsx con una sola hoja (escritura en memoria; nunca toca la bitácora). */
export function exportarExcel(nombreArchivo: string, hoja: string, filas: (string | number)[][]) {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), hoja.slice(0, 31));
  XLSX.writeFile(libro, nombreArchivo);
}
