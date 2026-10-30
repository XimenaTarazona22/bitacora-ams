const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

export const formatearNumero = (n: number) => nf.format(n);

/** 7,5 h (decimal) o 7:30 (hm). */
export function formatearHoras(h: number, modo: 'decimal' | 'hm' = 'decimal'): string {
  if (modo === 'hm') {
    const min = Math.round(h * 60);
    return `${Math.trunc(min / 60)}:${String(Math.abs(min % 60)).padStart(2, '0')}`;
  }
  return `${nf.format(h)} h`;
}

/** Quita el prefijo «M - » / «E - » del estado. */
export const estadoSinPrefijo = (estado: string) => estado.replace(/^[A-Za-z]\s*-\s*/, '');
