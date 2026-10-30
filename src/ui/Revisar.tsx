import { useState } from 'react';
import type { ConfigApp } from '../dominio/config';
import { estadoSinPrefijo, formatearHoras } from '../dominio/formato';
import { type Periodo, enRango, etiquetaDia, etiquetaPeriodo, rangoCompleto, rangoPeriodo } from '../dominio/periodos';
import { type Alertas, jornadasLargas, resumenRevision } from '../dominio/reglas';
import { ETIQUETA_REGLA, ORDEN_REGLAS, aplicarFiltros, conteosPorTipo, filasRevision, textoPorConsultor, textoQueFalta } from '../dominio/revision';
import type { ReglaId, Registro } from '../dominio/tipos';
import { ControlPeriodo } from './ControlPeriodo';
import { exportarExcel } from './exportarExcel';

interface Props {
  registros: Registro[];
  alertas: Alertas;
  cfg: ConfigApp;
  onCfg: (c: ConfigApp) => void;
  periodo: Periodo;
  onPeriodo: (p: Periodo) => void;
}

const vacio = <em style={{ color: 'var(--alerta-texto)' }}>vacío</em>;

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Respaldo para contextos sin la API del portapapeles
    const t = document.createElement('textarea');
    t.value = texto;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}

export function Revisar({ registros, alertas, cfg, onCfg, periodo, onPeriodo }: Props) {
  const [incluirFin, setIncluirFin] = useState(true);
  const [activos, setActivos] = useState<ReglaId[]>([]);
  const [mensaje, setMensaje] = useState('');
  const h = (n: number) => formatearHoras(n, cfg.formatoHoras);

  const rango = incluirFin ? rangoCompleto(periodo) : rangoPeriodo(periodo);
  // Los registros sin fecha no pertenecen a ningún periodo: se muestran siempre.
  const delPeriodo = registros.filter((r) => !r.fecha || enRango(r.fecha, rango));
  const largas = cfg.reglasActivas.jornadaLarga ? jornadasLargas(delPeriodo.filter((r) => r.fecha), cfg.jornadaLarga) : [];
  const filas = filasRevision(delPeriodo, alertas, largas);
  const conteos = conteosPorTipo(filas);
  const resumen = resumenRevision(delPeriodo, alertas, rango);
  const visibles = aplicarFiltros(filas, activos).sort(
    (a, b) => (b.registro.fecha ?? '').localeCompare(a.registro.fecha ?? '') || a.registro.hoja.localeCompare(b.registro.hoja) || a.registro.fila - b.registro.fila,
  );

  const alternar = (t: ReglaId) => setActivos((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));
  const cambiarRegla = (t: ReglaId, v: boolean) => {
    onCfg({ ...cfg, reglasActivas: { ...cfg.reglasActivas, [t]: v } });
    setActivos((a) => a.filter((x) => x !== t));
  };

  async function copiarLista() {
    const ok = await copiar(textoPorConsultor(visibles, etiquetaPeriodo(periodo)));
    setMensaje(ok ? `Lista copiada (${visibles.length} registros). Pégala en un correo o en Teams.` : 'No se pudo copiar. Usa «Exportar a Excel».');
  }

  function exportar() {
    exportarExcel(`Registros_a_revisar_${rango.desde}_al_${rango.hasta}.xlsx`, 'A revisar', [
      ['Hoja', 'Fila', 'Fecha', 'Consultor', 'Cliente', 'Caso', 'Título', 'Estado', 'Horas', 'Qué falta'],
      ...visibles.map(({ registro: r, tipos }) => [
        r.hoja, r.fila, r.fecha ?? '', r.consultor, r.cliente, r.casoOriginal, r.titulo, estadoSinPrefijo(r.estado), r.horas, textoQueFalta({ registro: r, tipos }),
      ]),
    ]);
  }

  const partes = [`${resumen.habiles} en días hábiles`, `${resumen.finDeSemana} en fin de semana`];
  if (resumen.sinFecha) partes.push(`${resumen.sinFecha} sin fecha`);

  return (
    <>
      <header>
        <h1>Registros a revisar</h1>
        <p className="subtitulo" aria-live="polite">
          {etiquetaPeriodo(periodo)} · {resumen.total} {resumen.total === 1 ? 'registro' : 'registros'}: {partes.join(', ')}
        </p>
      </header>

      <div className="controles">
        <ControlPeriodo periodo={periodo} onPeriodo={onPeriodo} />
        <label className="casilla">
          <input type="checkbox" checked={incluirFin} onChange={(e) => setIncluirFin(e.target.checked)} />
          Incluir sábado y domingo
        </label>
      </div>

      <section className="alertas" aria-label="Tipos de alerta (filtros)">
        {ORDEN_REGLAS.filter((t) => cfg.reglasActivas[t]).map((t) => (
          <button key={t} className="alerta-tipo" aria-pressed={activos.includes(t)} onClick={() => alternar(t)}>
            <span className="alerta-num">{conteos[t]}</span>
            <span>{ETIQUETA_REGLA[t]}{t === 'jornadaLarga' && ` (≥ ${cfg.jornadaLarga} h)`}</span>
          </button>
        ))}
      </section>
      {activos.length > 0 && (
        <p className="subtitulo">
          Filtrando por: {activos.map((t) => ETIQUETA_REGLA[t]).join(', ')}.{' '}
          <button className="enlace" onClick={() => setActivos([])}>Quitar filtros</button>
        </p>
      )}

      <section className="tarjeta">
        <div className="cabecera-tabla">
          <h2>{visibles.length} {visibles.length === 1 ? 'registro' : 'registros'} en la lista</h2>
          <div className="controles">
            <button className="btn btn-primario" onClick={() => void copiarLista()} disabled={visibles.length === 0}>Copiar lista por consultor</button>
            <button className="btn" onClick={exportar} disabled={visibles.length === 0}>Exportar a Excel</button>
          </div>
        </div>
        {mensaje && <p role="status" className="subtitulo">{mensaje}</p>}
        <div className="envoltura">
          <table>
            <thead>
              <tr>
                <th scope="col">Hoja</th><th scope="col" className="num">Fila</th><th scope="col">Fecha</th><th scope="col">Cliente</th>
                <th scope="col">Caso</th><th scope="col">Título</th><th scope="col">Estado</th><th scope="col" className="num">Horas</th><th scope="col">Qué falta</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(({ registro: r, tipos }) => (
                <tr key={`${r.hoja}-${r.fila}`}>
                  <td>{r.hoja}</td>
                  <td className="num">{r.fila}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.fecha ? etiquetaDia(r.fecha) : vacio}</td>
                  <td>{r.cliente || vacio}</td>
                  <td className="mono">{r.casoOriginal || vacio}</td>
                  <td>{r.titulo || '—'}</td>
                  <td>{r.estado ? estadoSinPrefijo(r.estado) : vacio}</td>
                  <td className="num">{h(r.horas)}</td>
                  <td>{tipos.map((t) => <span key={t} className="insignia" style={{ marginRight: 4, display: 'inline-block' }}>{ETIQUETA_REGLA[t]}</span>)}</td>
                </tr>
              ))}
              {visibles.length === 0 && <tr><td colSpan={9} className="vacio">No hay registros por revisar en este periodo.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tarjeta">
        <h2>Reglas de validación</h2>
        <p className="subtitulo" style={{ marginTop: 0 }}>Son las mismas de Configuración. Desactiva una regla para que deje de generar alertas.</p>
        <div className="reglas">
          {ORDEN_REGLAS.map((t) => (
            <label key={t} className="casilla">
              <input type="checkbox" checked={cfg.reglasActivas[t]} onChange={(e) => cambiarRegla(t, e.target.checked)} />
              {ETIQUETA_REGLA[t]}
            </label>
          ))}
          <label className="casilla">
            Jornada larga desde
            <input
              type="number" min={1} max={24} step={0.5} value={cfg.jornadaLarga} aria-label="Horas por día para marcar jornada larga"
              style={{ width: 80, minHeight: 44, margin: '0 6px', border: '1px solid var(--borde)', borderRadius: 8, padding: '0 8px' }}
              onChange={(e) => { const v = Number(e.target.value); if (v > 0) onCfg({ ...cfg, jornadaLarga: v }); }}
            />
            h por consultor y día
          </label>
        </div>
      </section>
    </>
  );
}
