// Genera fixtures/bitacora-sintetica.xlsx: misma estructura que la bitácora real, datos inventados.
import * as XLSX from 'xlsx';
import * as fs from 'node:fs';
import { mkdirSync } from 'node:fs';

XLSX.set_fs(fs);

const ENC = ['Fecha', 'Cliente', 'Consultor', 'Tipo', 'Caso', 'Título del Caso', 'Consultor de Apoyo', 'Estado',
  'Hora Inicio', 'Hora Fin', 'Tiempo Invertido', 'Clasificación Hora', 'Contrato Anterior', 'Actividades Realizadas'];

const serial = (iso) => Date.UTC(...iso.split('-').map((n, i) => (i === 1 ? n - 1 : +n))) / 864e5 + 25569;
const h = (hh, mm = 0) => (hh + mm / 60) / 24;
const LUN = '2026-10-19', MAR = '2026-10-20', MIE = '2026-10-21', JUE = '2026-10-22', VIE = '2026-10-23', SAB = '2026-10-24';

// [fecha, cliente, consultor, tipo, caso, titulo, estado, ini, fin, tiempo, actividades]
function fila(f, cli, con, tipo, caso, titulo, estado, ini, fin, tiempo, act = '') {
  return [f ? serial(f) : null, cli, con, tipo, caso, titulo, null, estado, ini, fin, tiempo, tiempo === null ? null : 'Hora Normal', null, act];
}

const ana = [
  fila(LUN, 'ACH', 'Ana Perez', 'Evolutivo', 'TASK0050017', 'Titulo A', 'M - Solucionado', h(8), h(12), 4,
    'Buenas tardes,\nSe revisa el proceso.\nQuedo atento.\nSaludos'),
  fila(LUN, 'ACH', 'Ana Perez', 'Evolutivo', 'TASK0050017', 'Titulo A', 'M - Solucionado', h(13), h(17, 30), 4.499999999999999, 'Se ajusta el proceso.'),
  fila(MAR, 'Davivienda HCM', 'Ana Perez', 'Mesa Ayuda', 3732.0, 'Titulo B', 'M - Proceso', h(8), h(16), 8, 'Ajuste de modelo.'),
  fila(MAR, 'ACH ', 'Ana Perez', 'Mesa Ayuda', 'SinCaso', '', '', h(16), h(17), 1, ''),
  fila(MIE, 'ACH', 'Ana Perez', 'Mesa Ayuda', 'SIN CASO', '', 'M - Pendiente Cliente', h(8), h(10), 2, 'Reunion.'),
  fila(JUE, 'SDS', 'Ana Perez', 'Preventa', 'Seguimiento ACH', 'Seguimiento', 'E - Construcción', h(8), h(9), 1, 'Seguimiento.'),
  fila(SAB, 'ACH', 'Ana Perez', 'Mesa Ayuda', null, '', 'M - Proceso', h(8), h(10), 2, 'Trabajo en sabado.'),
  fila(VIE, 'ACH', 'Ana Perez', 'Mesa Ayuda', 'PRB0043331', 'Titulo C (ver TASK0050017)', 'M - Proceso', h(8), h(9, 30), null, 'Sin tiempo: se recalcula.'),
  fila(VIE, 'ACH', 'Ana Perez', 'Mesa Ayuda', 'INC1604646', 'Titulo D', 'M - Proceso', h(10), h(9), -1, 'Hora fin antes de inicio.'),
  Array(14).fill(null), // fila vacía
  fila(null, 'ACH', 'Ana Perez', 'Mesa Ayuda', 123, 'Sin fecha', 'M - Proceso', h(8), h(9), 1, 'Fila sin fecha.'),
];

const luis = [
  fila(LUN, 'Davivienda ERP', 'Luis Mora', 'Evolutivo', 'DAV-EVO-028', 'Titulo E', 'E - Construcción', h(9), h(12), 3, 'Franja 1.'),
  fila(LUN, 'Davivienda ERP', 'Luis Mora', 'Evolutivo', 'DAV-EVO-028', 'Titulo E', 'E - Construcción', h(11), h(13), 2, 'Franja que se cruza.'),
  fila(LUN, 'ACH', 'Luis Mora', 'Mesa Ayuda', 0, '', '', h(14), h(15), 1, ''),
  fila(MAR, 'ACH', 'Luis Mora', 'Mesa Ayuda', '  prb0043331 ', 'Titulo C', 'M - Solucionado', h(8), h(10), 2, 'Cierre.'),
];

const libro = XLSX.utils.book_new();
const agregar = (nombre, aoa, oculta = false) => {
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(aoa), nombre);
  if (oculta) {
    libro.Workbook ??= { Sheets: [] };
    libro.Workbook.Sheets[libro.SheetNames.length - 1] = { Hidden: 1 };
  }
};

agregar('Ana P', [ENC, ...ana]);
agregar('Luis M', [
  ENC.map((e) => (e === 'Caso' ? 'No Caso' : e)).concat(Array(10).fill(null), ['HORAS TOTALES']),
  ...luis.map((f) => f.concat(Array(10).fill(null), [f[10] === null ? null : f[10] * 1.75])),
]);
agregar('Causa', [['Error procedimental', 'Usar cuando...']]);
agregar('Xlat', [[], ['Cliente', 'Tipo', 'Estado']], true);
agregar('Horas por Consultor Todos', [['Cliente', '(Todas)']]);
agregar('Detalle1', [['Detalles para Suma de Tiempo Invertido']]);
agregar('Hoja1', [['Cliente', 'ACH'], ['Fecha', '(Varios elementos)']]);

mkdirSync('fixtures', { recursive: true });
XLSX.writeFile(libro, 'fixtures/bitacora-sintetica.xlsx');
console.log('fixtures/bitacora-sintetica.xlsx generado');
