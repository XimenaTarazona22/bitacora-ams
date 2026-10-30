// Genera fixtures/control-sintetico.xlsx: Control seguimiento AMS inventado.
// Solo importan N°Caso y Servicio/Tecnología; el resto de columnas y hojas existen para que la app las ignore.
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';

XLSX.set_fs(fs);

const libro = XLSX.utils.book_new();
const agregar = (nombre, filas) => XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), nombre);

agregar('Catalogos', [['Clientes', 'Servicios'], ['Davivienda', 'HCM']]);
agregar('Seguimiento', [['ID Seguimiento', 'ID Caso'], [1, 'TASK0050017']]);
agregar('Registro_Casos', [
  ['Cliente', 'N°Caso', 'Servicio/Tecnología', 'Tipo', 'Estado'],
  ['ACH', 'TASK0050017 ', 'HCM', 'Requerimiento', 'Solucionado'], // espacio final: debe cruzar igual
  ['ACH', 'PRB0043331', 'ERP', 'Incidente', 'Abierto'],
  ['Bolivar', 3732, 'PeopleSoft', 'Incidente', 'Cerrado'], // número: la bitácora lo escribe igual
  ['Davivienda', 'DAV-EVO-028', 'GCP', 'Evolutivo', 'En curso'],
  ['Fiduprevisora', 74312, 'PeopleSoft', 'Incidente', 'Cerrado'], // la bitácora lo escribe IM-74312
  ['ACH', 'INC1604646', 'ERP', 'Incidente', 'Abierto'], // conflicto: dos tecnologías
  ['ACH', 'INC1604646', 'HCM', 'Incidente', 'Abierto'],
  ['ACH', 'TASK0000001', null, 'Incidente', 'Abierto'], // sin tecnología
]);

fs.mkdirSync('fixtures', { recursive: true });
XLSX.writeFile(libro, 'fixtures/control-sintetico.xlsx');
console.log('fixtures/control-sintetico.xlsx generado');
