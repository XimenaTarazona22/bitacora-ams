import { describe, expect, it } from 'vitest';
import { ErrorBitacora, mensajeError, textoLectura, validarResultado } from '../src/almacenamiento/archivo';

const dom = (nombre: string) => Object.assign(new Error('x'), { name: nombre });

describe('mensajeError', () => {
  it('explica archivo no encontrado', () => expect(mensajeError(dom('NotFoundError'))).toMatch(/No se encontró/));
  it('explica permiso denegado', () => expect(mensajeError(dom('NotAllowedError'))).toMatch(/permiso/));
  it('explica bloqueo / solo en la nube', () => {
    expect(mensajeError(dom('NotReadableError'))).toMatch(/Mantener siempre en este dispositivo/);
  });
  it('formato inválido incluye el detalle', () => {
    expect(mensajeError(new Error('Unsupported file'))).toMatch(/\.xlsx.*Unsupported file/);
  });
  it('respeta ErrorBitacora', () => expect(mensajeError(new ErrorBitacora('hola'))).toBe('hola'));
});

describe('validarResultado', () => {
  it('rechaza libros sin hojas de consultor', () => {
    expect(() => validarResultado({ registros: [], hojasConsultor: [], hojasIgnoradas: ['A'] })).toThrow(/hoja de consultor/);
  });
});

describe('textoLectura', () => {
  it('formatea hora es-CO y miles', () => {
    const t = textoLectura(new Date(2026, 9, 23, 15, 5), 1258, new Date(2026, 9, 23, 18, 0));
    expect(t).toMatch(/^Datos leídos hoy 3:05 p\.\s?m\. · 1\.258 registros$/);
  });
  it('usa la fecha si no es hoy', () => {
    expect(textoLectura(new Date(2026, 9, 22, 9, 0), 5, new Date(2026, 9, 23))).toMatch(/22/);
  });
});
