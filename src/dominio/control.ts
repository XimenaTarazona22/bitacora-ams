import * as XLSX from 'xlsx';
import { normalizarCaso, normalizarEncabezado, texto } from './normalizar';
import type { Registro } from './tipos';

export const SIN_TECNOLOGIA = 'Sin tecnología';
/** Valor a mostrar y filtrar para la tecnología de un registro. */
export const tecnologiaDe = (r: Pick<Registro, 'tecnologia'>) => r.tecnologia || SIN_TECNOLOGIA;

const COLUMNAS_CASO = ['n caso', 'no caso', 'caso', 'numero de caso', 'numero caso', 'nro caso', 'id caso'];
const COLUMNAS_TECNOLOGIA = ['servicio tecnologia', 'tecnologia'];

/**
 * Clave para cruzar un caso de la bitácora con el del Control: sin espacios sobrantes, en mayúsculas y sin el
 * prefijo «IM-» (el Control guarda 74312 donde la bitácora escribe IM-74312).
 */
export const claveCaso = (v: unknown) => normalizarCaso(v).toUpperCase().replace(/^IM[\s-]*(?=\d)/, '');

export interface ResultadoControl {
  /** Hoja de la que se leyó; vacía si el libro no tiene las columnas esperadas. */
  hoja: string;
  /** clave de caso (ver claveCaso) → tecnología */
  tecnologias: Record<string, string>;
  /** Casos distintos con tecnología. */
  casos: number;
  /** Casos que aparecen con más de una tecnología; se usa la primera. */
  conflictos: { caso: string; tecnologias: string[] }[];
  /** Filas con caso pero sin tecnología. */
  filasSinTecnologia: number;
}

/** Lee del libro de Control solo el caso y la tecnología, buscando la hoja por sus encabezados. */
export function leerControl(datos: ArrayBuffer | Uint8Array): ResultadoControl {
  const libro = XLSX.read(datos, { type: 'array' });
  const vacio: ResultadoControl = { hoja: '', tecnologias: {}, casos: 0, conflictos: [], filasSinTecnologia: 0 };

  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre];
    if (!hoja) continue;
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: null });
    const enc = (filas[0] ?? []).map(normalizarEncabezado);
    const iCaso = enc.findIndex((h) => COLUMNAS_CASO.includes(h));
    const iTec = enc.findIndex((h) => COLUMNAS_TECNOLOGIA.includes(h));
    if (iCaso < 0 || iTec < 0) continue;

    const vistas = new Map<string, string[]>();
    let filasSinTecnologia = 0;
    for (const f of filas.slice(1)) {
      const clave = claveCaso(f[iCaso]);
      if (!clave) continue;
      const tec = texto(f[iTec]);
      if (!tec) { filasSinTecnologia++; continue; }
      const lista = vistas.get(clave) ?? [];
      if (!lista.includes(tec)) lista.push(tec);
      vistas.set(clave, lista);
    }
    const tecnologias: Record<string, string> = {};
    const conflictos: ResultadoControl['conflictos'] = [];
    for (const [clave, lista] of vistas) {
      tecnologias[clave] = lista[0]!;
      if (lista.length > 1) conflictos.push({ caso: clave, tecnologias: lista });
    }
    return { hoja: nombre, tecnologias, casos: vistas.size, conflictos, filasSinTecnologia };
  }
  return vacio;
}

/** Asigna a cada registro la tecnología de su caso. Sin Control (null) devuelve el mismo arreglo. */
export function aplicarTecnologia(registros: Registro[], tecnologias: Record<string, string> | null): Registro[] {
  if (!tecnologias) return registros;
  return registros.map((r) => {
    const t = tecnologias[claveCaso(r.caso)] ?? '';
    return t === r.tecnologia ? r : { ...r, tecnologia: t };
  });
}
