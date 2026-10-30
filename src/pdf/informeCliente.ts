import JSZip from 'jszip';
import pdfMake from 'pdfmake/build/pdfmake';
import type { Content, ContentColumns, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import type { ConfigApp } from '../dominio/config';
import { formatearNumero } from '../dominio/formato';
import { type Informe, nombreArchivoInforme, nombreParaPdf } from '../dominio/informe';
import { esSemanaLV, etiquetaDiaCorta, etiquetaLarga } from '../dominio/periodos';
// ?inline entrega la fuente como data URL: el PDF no depende de ningún archivo externo.
import mono400 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff?inline';
import sans400 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?inline';
import sans600 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?inline';

const AZUL = '#16203A';
const ACENTO = '#1F5FBF';
const TENUE = '#5A6477';
const LINEA = '#DDE1E8';
const base64 = (url: string) => url.slice(url.indexOf(',') + 1);

let fuentesListas = false;
/** Registra las fuentes incrustadas (IBM Plex en WOFF: pdfmake no lee WOFF2). */
export function prepararPdfMake() {
  if (fuentesListas) return;
  pdfMake.addVirtualFileSystem({ 'sans-400.woff': base64(sans400), 'sans-600.woff': base64(sans600), 'mono-400.woff': base64(mono400) });
  pdfMake.addFonts({
    Plex: { normal: 'sans-400.woff', bold: 'sans-600.woff', italics: 'sans-400.woff', bolditalics: 'sans-600.woff' },
    PlexMono: { normal: 'mono-400.woff', bold: 'mono-400.woff', italics: 'mono-400.woff', bolditalics: 'mono-400.woff' },
  });
  fuentesListas = true;
}

const num = (n: number) => formatearNumero(n);
// El subconjunto de IBM Plex Mono incrustado no trae el espacio (pdfmake falla): solo los códigos sin espacios van en mono.
const fuenteCaso = (caso: string) => (/^[A-Za-z0-9-]+$/.test(caso) ? 'PlexMono' : 'Plex');
const tituloSeccion = (t: string): Content => ({ text: t, fontSize: 12, bold: true, color: AZUL, margin: [0, 16, 0, 6] });

const PAGINA = { carta: { tamano: 'LETTER' as const, ancho: 612 }, a4: { tamano: 'A4' as const, ancho: 595 } };
const MARGEN_LADO = 50;

function indicadores(i: Informe): Content {
  const caja = (valor: string, rotulo: string): Content => ({
    table: { widths: ['*'], body: [[{ stack: [{ text: valor, fontSize: 18, bold: true, color: AZUL }, { text: rotulo, fontSize: 8.5, color: TENUE }], fillColor: '#F4F5F7', margin: [6, 4, 6, 4] }]] },
    layout: 'noBorders',
  });
  return {
    columns: [caja(`${num(i.totalHoras)} h`, 'Horas del periodo'), caja(String(i.casos), i.casos === 1 ? 'Caso atendido' : 'Casos atendidos'), caja(String(i.consultores.length), i.consultores.length === 1 ? 'Consultor' : 'Consultores')],
    columnGap: 10,
    margin: [0, 0, 0, 14],
  } satisfies ContentColumns;
}

function tablaCasos(i: Informe, cfg: ConfigApp): Content {
  const c = i.opciones.contenido;
  const cols = [
    { id: 'caso', titulo: 'Caso', ancho: 80, derecha: false, on: true },
    { id: 'descripcion', titulo: 'Descripción', ancho: '*' as const, derecha: false, on: true },
    { id: 'consultor', titulo: 'Consultor', ancho: 72, derecha: false, on: c.consultor },
    { id: 'estado', titulo: 'Estado', ancho: 74, derecha: false, on: true },
    { id: 'horas', titulo: 'Horas', ancho: 42, derecha: true, on: c.horasPorCaso },
    { id: 'acumulado', titulo: 'Acumulado', ancho: 56, derecha: true, on: c.acumulado },
  ].filter((x) => x.on);

  const cabecera: TableCell[] = cols.map((x) => ({ text: x.titulo, bold: true, fontSize: 8.5, fillColor: '#EEF1F6', alignment: x.derecha ? 'right' : 'left' }));
  const celda = (id: string, f: Informe['filas'][number]): TableCell => {
    switch (id) {
      case 'caso': return { text: f.caso, font: fuenteCaso(f.caso), fontSize: 8.5 };
      case 'descripcion': return { text: f.descripcion || '—' };
      case 'consultor': return { text: f.consultores.map((n) => nombreParaPdf(n, cfg.pdf.nombres)).join(', '), fontSize: 8.5 };
      case 'estado': return { text: f.estado || '—', fontSize: 8.5 };
      case 'horas': return { text: num(f.horas), alignment: 'right' };
      default: return { text: f.acumulado === null ? '—' : num(f.acumulado), alignment: 'right' };
    }
  };
  const cuerpo: TableCell[][] = i.filas.map((f) => cols.map((x) => celda(x.id, f)));

  const primeraNumerica = cols.findIndex((x) => x.derecha);
  if (primeraNumerica > 0) {
    const total: TableCell[] = [{ text: 'Total', bold: true, colSpan: primeraNumerica }, ...Array.from({ length: primeraNumerica - 1 }, () => ({}))];
    for (const x of cols.slice(primeraNumerica)) {
      total.push({ text: x.id === 'horas' ? num(i.totalHoras) : num(i.totalAcumulado), bold: true, alignment: 'right' });
    }
    cuerpo.push(total);
  }

  return {
    table: { headerRows: 1, dontBreakRows: true, widths: cols.map((x) => x.ancho), body: [cabecera, ...cuerpo] },
    fontSize: 9,
    layout: {
      hLineWidth: (n, nodo) => (n === 0 || n === nodo.table.body.length ? 0 : n === nodo.table.body.length - 1 && primeraNumerica > 0 ? 1 : 0.5),
      hLineColor: (n, nodo) => (n === nodo.table.body.length - 1 && primeraNumerica > 0 ? AZUL : LINEA),
      vLineWidth: () => 0,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  };
}

function resumenes(i: Informe): Content[] {
  return i.filas.flatMap((f): Content[] => [
    {
      unbreakable: true,
      margin: [0, 0, 0, 7],
      stack: [
        { text: [{ text: f.general ? 'Actividades generales' : f.caso, font: f.general ? 'Plex' : fuenteCaso(f.caso), bold: f.general, fontSize: 9, color: AZUL }, { text: ` · ${num(f.horas)} h`, bold: true, fontSize: 9 }], margin: [0, 0, 0, 2] },
        { text: f.resumen.trim() || 'Sin actividades registradas.', fontSize: 9, lineHeight: 1.15 },
      ],
    },
  ]);
}

function detallePorDia(i: Informe): Content {
  const dias = i.dias;
  const h = (n: number) => (n === 0 ? '–' : num(n));
  if (dias.length <= 7) {
    const cabecera: TableCell[] = [
      { text: 'Caso', bold: true, fillColor: '#EEF1F6' },
      ...dias.map((d): TableCell => ({ text: etiquetaDiaCorta(d), bold: true, fillColor: '#EEF1F6', alignment: 'right' })),
      { text: 'Total', bold: true, fillColor: '#EEF1F6', alignment: 'right' },
    ];
    const filas: TableCell[][] = i.filas.map((f, n) => [
      { text: f.general ? 'General' : f.caso, font: f.general ? 'Plex' : fuenteCaso(f.caso), fontSize: 8.5 },
      ...i.detalle[n]!.map((v): TableCell => ({ text: h(v), alignment: 'right' })),
      { text: num(f.horas), alignment: 'right', bold: true },
    ]);
    const total: TableCell[] = [{ text: 'Total', bold: true }, ...i.horasPorDia.map((v): TableCell => ({ text: h(v), alignment: 'right', bold: true })), { text: num(i.totalHoras), alignment: 'right', bold: true }];
    return {
      table: { headerRows: 1, dontBreakRows: true, widths: ['*', ...dias.map(() => 40), 44], body: [cabecera, ...filas, total] },
      fontSize: 9,
      layout: { hLineWidth: () => 0.5, hLineColor: () => LINEA, vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3 },
    };
  }
  // Rangos largos: una fila por día y caso con horas (la matriz no cabe en la página).
  const filas: TableCell[][] = [];
  dias.forEach((d, k) => i.filas.forEach((f, n) => { if (i.detalle[n]![k]! > 0) filas.push([{ text: d }, { text: f.general ? 'General' : f.caso, font: f.general ? 'Plex' : fuenteCaso(f.caso), fontSize: 8.5 }, { text: num(i.detalle[n]![k]!), alignment: 'right' }]); }));
  return {
    table: { headerRows: 1, dontBreakRows: true, widths: [70, '*', 50], body: [[{ text: 'Fecha', bold: true, fillColor: '#EEF1F6' }, { text: 'Caso', bold: true, fillColor: '#EEF1F6' }, { text: 'Horas', bold: true, fillColor: '#EEF1F6', alignment: 'right' }], ...filas] },
    fontSize: 9,
    layout: { hLineWidth: () => 0.5, hLineColor: () => LINEA, vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3 },
  };
}

const ALTO_GRAFICA = 90;
function graficaPorDia(i: Informe, anchoUtil: number): Content {
  const anchoCol = Math.min(64, anchoUtil / Math.max(i.dias.length, 1));
  const max = Math.max(...i.horasPorDia, 1);
  const barra = Math.max(anchoCol - 18, 8);
  return {
    columns: i.dias.map((d, k) => {
      const alto = (i.horasPorDia[k]! / max) * (ALTO_GRAFICA - 4);
      return {
        width: anchoCol,
        stack: [
          { canvas: [
            { type: 'rect', x: 0, y: 0, w: 0.1, h: ALTO_GRAFICA, color: '#FFFFFF' },
            { type: 'rect', x: (anchoCol - barra) / 2, y: ALTO_GRAFICA - alto, w: barra, h: alto, color: ACENTO },
          ] },
          { text: etiquetaDiaCorta(d), fontSize: 7.5, alignment: 'center', color: TENUE, margin: [0, 3, 0, 0] },
          { text: num(i.horasPorDia[k]!), fontSize: 8, alignment: 'center', bold: true },
        ],
      } as Content;
    }),
    columnGap: 0,
  };
}

/** Definición del documento (separada de la generación para poder probarla). */
export function definicionInforme(i: Informe, cfg: ConfigApp, logo: string | null): TDocumentDefinitions {
  const { tamano, ancho } = PAGINA[cfg.pdf.papel];
  const anchoUtil = ancho - MARGEN_LADO * 2;
  const o = i.opciones;
  const semanal = esSemanaLV(o.rango);

  const contenido: Content[] = [
    { text: `${o.cliente} · Horas invertidas por caso`, fontSize: 16, bold: true, color: AZUL },
    { text: etiquetaLarga(o.rango), fontSize: 10.5, color: TENUE, margin: [0, 2, 0, 12] },
    indicadores(i),
    i.filas.length > 0 ? tablaCasos(i, cfg) : { text: 'No hay horas registradas para este cliente en el periodo.', italics: true, color: TENUE },
  ];
  if (o.contenido.resumen && i.filas.length > 0) contenido.push(tituloSeccion('Resumen de actividades'), ...resumenes(i));
  if (o.contenido.detallePorDia && i.filas.length > 0) contenido.push(tituloSeccion('Detalle por día'), detallePorDia(i));
  if (o.contenido.grafica && i.dias.length > 0) contenido.push(tituloSeccion('Horas por día'), graficaPorDia(i, anchoUtil));
  if (o.nota.trim()) contenido.push(tituloSeccion('Nota'), { text: o.nota.trim(), fontSize: 9.5, lineHeight: 1.2 });

  return {
    pageSize: tamano,
    pageMargins: [MARGEN_LADO, 84, MARGEN_LADO, 56],
    info: { title: `${o.cliente} · Horas invertidas por caso`, author: cfg.pdf.empresa || undefined },
    defaultStyle: { font: 'Plex', fontSize: 9.5, color: '#1C2333' },
    header: () => ({
      margin: [MARGEN_LADO, 26, MARGEN_LADO, 0],
      stack: [
        {
          columns: [
            logo ? { image: logo, fit: [130, 34], width: 130 } : { text: cfg.pdf.empresa, bold: true, fontSize: 12, color: AZUL, width: 130 },
            { width: '*', alignment: 'right', stack: [
              { text: semanal ? 'Informe semanal de horas' : 'Informe de horas', bold: true, fontSize: 11, color: AZUL },
              { text: `Emitido: ${etiquetaLarga({ desde: i.emitido, hasta: i.emitido })}`, fontSize: 8.5, color: TENUE },
            ] },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 6, x2: anchoUtil, y2: 6, lineWidth: 1.5, lineColor: AZUL }] },
      ],
    }),
    footer: (pagina, paginas) => ({
      margin: [MARGEN_LADO, 14, MARGEN_LADO, 0],
      columns: [
        { text: cfg.pdf.pie, fontSize: 8, color: TENUE },
        { text: `Página ${pagina} de ${paginas}`, fontSize: 8, color: TENUE, alignment: 'right' },
      ],
    }),
    content: contenido,
  };
}

export function crearPdf(i: Informe, cfg: ConfigApp, logo: string | null): Promise<Blob> {
  prepararPdfMake();
  return pdfMake.createPdf(definicionInforme(i, cfg, logo)).getBlob();
}

/** Empaqueta varios informes en un .zip (un PDF por cliente). */
export async function empaquetarZip(informes: { informe: Informe; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  const usados = new Set<string>();
  for (const { informe, blob } of informes) {
    let nombre = nombreArchivoInforme(informe.opciones.cliente, informe.opciones.rango);
    for (let n = 2; usados.has(nombre); n++) nombre = nombre.replace(/(_\d+)?\.pdf$/, `_${n}.pdf`);
    usados.add(nombre);
    zip.file(nombre, blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
