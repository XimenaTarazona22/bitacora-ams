import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { buscarCasos, casosRelacionados, fichaCaso, registrosDelCaso } from '../dominio/casos';
import type { ConfigApp } from '../dominio/config';
import { estadoSinPrefijo, formatearHoras } from '../dominio/formato';
import { type Periodo, etiquetaDia, etiquetaSemana, rangoPeriodo, semanaLV } from '../dominio/periodos';
import { resumenPorEstado } from '../dominio/resumenActividades';
import type { Registro } from '../dominio/tipos';
import { BarrasSemanales } from './BarrasSemanales';
import { exportarExcel } from './exportarExcel';
import type { PresetInforme } from './Informe';

interface Props {
  registros: Registro[];
  cfg: ConfigApp;
  periodo: Periodo;
  /** Caso a mostrar (viene del enlace en el Tablero). */
  caso: string | null;
  onCaso: (c: string | null) => void;
  /** Abre el informe para cliente con este caso y todo su periodo. */
  onPdfCaso: (p: PresetInforme) => void;
}

const LARGO = 180;

function Estado({ estado }: { estado: string }) {
  if (!estado) return <em style={{ color: 'var(--alerta-texto)' }}>vacío</em>;
  return <span className={`pildora${/solucionad/i.test(estado) ? ' ok' : ''}`}>{estadoSinPrefijo(estado)}</span>;
}

export function Buscar({ registros, cfg, periodo, caso, onCaso, onPdfCaso }: Props) {
  const [consulta, setConsulta] = useState(caso ?? '');
  const [activo, setActivo] = useState(-1);
  const [abierto, setAbierto] = useState(false);
  const [sumarRel, setSumarRel] = useState<string[]>([]);
  const [expandidos, setExpandidos] = useState<Set<Registro>>(new Set());
  const h = (n: number) => formatearHoras(n, cfg.formatoHoras);

  useEffect(() => {
    if (caso) setConsulta(caso);
    setSumarRel([]);
  }, [caso]);

  const sugerencias = useMemo(() => buscarCasos(registros, cfg, consulta), [registros, cfg, consulta]);
  const principal = useMemo(() => (caso ? registrosDelCaso(registros, caso) : []), [registros, caso]);
  const relacionados = useMemo(() => (caso ? casosRelacionados(registros, caso) : []), [registros, caso]);

  // Con «Sumar en el total» marcado, los registros de los relacionados entran en todo el análisis.
  const efectivos = useMemo(
    () => [...principal, ...sumarRel.flatMap((c) => registrosDelCaso(registros, c))],
    [principal, sumarRel, registros],
  );
  const ficha = useMemo(() => fichaCaso(efectivos, periodo), [efectivos, periodo]);
  const resumen = useMemo(() => resumenPorEstado(efectivos), [efectivos]);
  const tabla = useMemo(
    () => [...efectivos].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '') || b.fila - a.fila),
    [efectivos],
  );

  function elegir(c: string) {
    setAbierto(false);
    setActivo(-1);
    onCaso(c);
  }

  function alTeclear(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { setAbierto(true); setActivo((a) => Math.min(a + 1, sugerencias.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setActivo((a) => Math.max(a - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter') {
      const s = sugerencias[activo] ?? sugerencias[0];
      if (s) elegir(s.caso);
    } else if (e.key === 'Escape') setAbierto(false);
  }

  const semana = periodo.modo === 'semana' ? etiquetaSemana(semanaLV(periodo.ancla)) : etiquetaDia(rangoPeriodo(periodo).desde);

  function exportar() {
    if (!ficha) return;
    exportarExcel(`Registros_${ficha.caso}.xlsx`, ficha.caso, [
      ['Hoja', 'Fila', 'Fecha', 'Caso', 'Cliente', 'Consultor', 'Estado', 'Horas', 'Actividades'],
      ...tabla.map((r) => [r.hoja, r.fila, r.fecha ?? '', r.caso, r.cliente, r.consultor, estadoSinPrefijo(r.estado), r.horas, r.actividades]),
    ]);
  }

  const alternarExpandido = (r: Registro) =>
    setExpandidos((s) => {
      const n = new Set(s);
      if (!n.delete(r)) n.add(r);
      return n;
    });

  return (
    <>
      <header>
        <h1>Buscar caso</h1>
        <p className="subtitulo">Suma las horas de todos los consultores que registraron el caso, en todas las hojas.</p>
      </header>

      <div className="buscador">
        <label htmlFor="buscar-caso" className="sr-only">Número, código o título del caso</label>
        <input
          id="buscar-caso"
          type="search"
          role="combobox"
          aria-expanded={abierto && sugerencias.length > 0}
          aria-controls="lista-sugerencias"
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? `sug-${activo}` : undefined}
          autoComplete="off"
          placeholder="Número o código del caso, o texto del título…"
          value={consulta}
          onChange={(e) => { setConsulta(e.target.value); setAbierto(true); setActivo(-1); }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          onKeyDown={alTeclear}
        />
        {abierto && sugerencias.length > 0 && (
          <ul id="lista-sugerencias" role="listbox" className="sugerencias">
            {sugerencias.map((s, i) => (
              <li key={s.caso} id={`sug-${i}`} role="option" aria-selected={i === activo} className={i === activo ? 'activa' : ''} onMouseDown={() => elegir(s.caso)}>
                <span className="mono">{s.caso}</span>
                <span className="sug-titulo">{s.titulo || '—'}</span>
                <span className="sug-meta">{s.cliente} · {h(s.horas)}</span>
              </li>
            ))}
          </ul>
        )}
        {abierto && consulta.trim() && sugerencias.length === 0 && (
          <div className="sugerencias vacio" role="status">No hay casos que coincidan con «{consulta.trim()}».</div>
        )}
      </div>

      {!caso && <p className="vacio">Escribe un número, un código o parte del título y elige el caso.</p>}
      {caso && !ficha && <p className="vacio">No hay registros para el caso «{caso}».</p>}

      {ficha && (
        <>
          <section className="tarjeta">
            <div className="cabecera-tabla">
              <div>
                <h2 className="mono" style={{ fontSize: 22, margin: 0 }}>{caso}</h2>
                <p style={{ margin: '4px 0 0' }}>{ficha.titulo || 'Sin título'}</p>
              </div>
              <div className="controles">
                <button className="btn btn-primario" onClick={() => onPdfCaso({ cliente: ficha.cliente, caso: ficha.caso, rango: { desde: ficha.primera ?? '', hasta: ficha.ultima ?? '' } })} disabled={!ficha.primera}>PDF de este caso</button>
                <button className="btn" onClick={exportar}>Exportar registros</button>
              </div>
            </div>
            <dl className="ficha">
              <div><dt>Cliente</dt><dd>{ficha.cliente}</dd></div>
              <div><dt>Tipo</dt><dd>{ficha.tipo || '—'}</dd></div>
              <div><dt>Consultor(es)</dt><dd>{ficha.consultores.join(', ')}</dd></div>
              <div>
                <dt>Último estado</dt>
                <dd><Estado estado={ficha.estado} />{ficha.estadoFecha && <span className="subtitulo"> · {etiquetaDia(ficha.estadoFecha)}</span>}</dd>
              </div>
            </dl>
          </section>

          {relacionados.length > 0 && (
            <section className="nota" aria-label="Casos relacionados">
              <strong>Caso relacionado:</strong>
              {relacionados.map((r) => (
                <label key={r.caso} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={sumarRel.includes(r.caso)}
                    onChange={(e) => setSumarRel(e.target.checked ? [...sumarRel, r.caso] : sumarRel.filter((c) => c !== r.caso))}
                  />
                  <span>
                    <button className="enlace mono" onClick={(e) => { e.preventDefault(); onCaso(r.caso); }}>{r.caso}</button>
                    {r.titulo && ` · ${r.titulo}`} ({h(r.horas)}). Sumar en el total
                  </span>
                </label>
              ))}
            </section>
          )}

          <section className="indicadores" aria-label="Indicadores del caso">
            <div className="indicador"><div className="rotulo">Horas acumuladas</div><div className="valor">{h(ficha.horas)}</div><div className="detalle">{sumarRel.length ? 'incluye casos relacionados' : 'todas las hojas'}</div></div>
            <div className="indicador"><div className="rotulo">Registros</div><div className="valor">{ficha.registros}</div><div className="detalle">{ficha.consultores.length} consultor{ficha.consultores.length === 1 ? '' : 'es'}</div></div>
            <div className="indicador">
              <div className="rotulo">Periodo</div>
              <div className="valor" style={{ fontSize: 18, lineHeight: 1.6 }}>{ficha.primera ? `${etiquetaDia(ficha.primera)} –` : '—'}<br />{ficha.ultima ? etiquetaDia(ficha.ultima) : ''}</div>
            </div>
            <div className="indicador"><div className="rotulo">Horas de la semana</div><div className="valor">{h(ficha.horasSemana)}</div><div className="detalle">{semana}</div></div>
          </section>

          {ficha.horasFinDeSemana > 0 && (
            <p className="nota" role="status">{h(ficha.horasFinDeSemana)} de este caso se registraron en fin de semana (en naranja en la gráfica).</p>
          )}
          {ficha.sinFecha > 0 && <p className="nota" role="status">{ficha.sinFecha} registro(s) sin fecha no aparecen en la gráfica ni en el periodo.</p>}

          <section className="tarjeta">
            <h2>Horas por semana (lun–vie)</h2>
            <BarrasSemanales semanas={ficha.semanas} formato={cfg.formatoHoras} />
          </section>

          <section className="tarjeta">
            <h2>Resumen de actividades por estado</h2>
            <div className="envoltura">
              <table>
                <thead>
                  <tr><th scope="col">Estado</th><th scope="col">Fechas</th><th scope="col" className="num">Registros</th><th scope="col" className="num">Horas</th><th scope="col">Actividades</th></tr>
                </thead>
                <tbody>
                  {resumen.map((r) => (
                    <tr key={r.estado}>
                      <td><Estado estado={r.estado} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.desde ? (r.desde === r.hasta ? etiquetaDia(r.desde) : `${etiquetaDia(r.desde)} – ${etiquetaDia(r.hasta!)}`) : '—'}</td>
                      <td className="num">{r.registros}</td>
                      <td className="num">{h(r.horas)}</td>
                      <td>{r.texto || <em className="subtitulo">Sin actividades registradas</em>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="tarjeta">
            <h2>Registros del caso ({tabla.length})</h2>
            <div className="envoltura">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    {sumarRel.length > 0 && <th scope="col">Caso</th>}
                    <th scope="col">Consultor</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Actividad</th>
                    <th scope="col" className="num">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {tabla.map((r) => {
                    const larga = r.actividades.length > LARGO;
                    const abierta = expandidos.has(r);
                    return (
                      <tr key={`${r.hoja}-${r.fila}`}>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.fecha ? etiquetaDia(r.fecha) : <span className="insignia">Sin fecha</span>}<br /><small className="subtitulo">{r.hoja}, fila {r.fila}</small></td>
                        {sumarRel.length > 0 && <td className="mono">{r.caso}</td>}
                        <td>{r.consultor}</td>
                        <td><Estado estado={r.estado} /></td>
                        <td style={{ whiteSpace: 'pre-wrap', maxWidth: 520 }}>
                          {r.actividades ? (abierta || !larga ? r.actividades : `${r.actividades.slice(0, LARGO).trimEnd()}…`) : <em className="subtitulo">Sin actividades</em>}
                          {larga && <> <button className="enlace" aria-expanded={abierta} onClick={() => alternarExpandido(r)}>{abierta ? 'Ver menos' : 'Ver más'}</button></>}
                        </td>
                        <td className="num">{h(r.horas)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
