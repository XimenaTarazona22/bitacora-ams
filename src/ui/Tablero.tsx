import { useState } from 'react';
import {
  type FilaCaso, casosDelPeriodo, filtrar, horasFinDeSemana, indicadores, mapaCalor, sumarPor, valoresUnicos,
} from '../dominio/agregaciones';
import type { ConfigApp } from '../dominio/config';
import { estadoSinPrefijo, formatearHoras, formatearNumero } from '../dominio/formato';
import {
  type Periodo, diasDelRango, esFinDeSemana, etiquetaDiaCorta, etiquetaPeriodo, lunesDe, moverPeriodo, rangoCompleto, rangoPeriodo,
} from '../dominio/periodos';
import { type Alertas, jornadasLargas, resumenRevision } from '../dominio/reglas';
import type { Registro } from '../dominio/tipos';
import { BarrasHorizontales } from './BarrasHorizontales';
import { MultiSelect } from './MultiSelect';
import { exportarExcel } from './exportarExcel';

interface Props {
  registros: Registro[];
  alertas: Alertas;
  cfg: ConfigApp;
  periodo: Periodo;
  onPeriodo: (p: Periodo) => void;
  textoLectura: string;
  onActualizar: () => void;
  onVerRevision: () => void;
  onVerCaso: (caso: string) => void;
}

type Columna = 'caso' | 'cliente' | 'titulo' | 'consultores' | 'estado' | 'horas';
const COLUMNAS: { id: Columna; titulo: string; num?: boolean }[] = [
  { id: 'caso', titulo: 'Caso' },
  { id: 'cliente', titulo: 'Cliente' },
  { id: 'titulo', titulo: 'Título' },
  { id: 'consultores', titulo: 'Consultor(es)' },
  { id: 'estado', titulo: 'Último estado' },
  { id: 'horas', titulo: 'Horas', num: true },
];

const valorColumna = (f: FilaCaso, c: Columna) => (c === 'consultores' ? f.consultores.join(', ') : f[c]);

export function Tablero(p: Props) {
  const { registros, cfg, periodo } = p;
  const [clientes, setClientes] = useState<string[]>([]);
  const [consultores, setConsultores] = useState<string[]>([]);
  const [texto, setTexto] = useState('');
  const [orden, setOrden] = useState<{ col: Columna; asc: boolean }>({ col: 'horas', asc: false });

  const rango = rangoPeriodo(periodo);
  const filtro = { rango, clientes, consultores, incluirFinDeSemana: cfg.sumarFinDeSemana };
  const filtroCompleto = { ...filtro, rango: rangoCompleto(periodo), incluirFinDeSemana: true };

  const regs = filtrar(registros, filtro);
  const regsCompletos = filtrar(registros, filtroCompleto);

  const ind = indicadores(regs, cfg);
  const revision = resumenRevision(regsCompletos, p.alertas, rangoCompleto(periodo));
  const fuera = cfg.sumarFinDeSemana ? 0 : horasFinDeSemana(registros, filtroCompleto);
  const dias = diasDelRango(rangoCompleto(periodo), cfg.sumarFinDeSemana);
  const calor = mapaCalor(regs, dias);
  const largas = jornadasLargas(regs, cfg.jornadaLarga);
  const esLarga = (consultor: string, fecha: string) => largas.some((j) => j.consultor === consultor && j.fecha === fecha);
  const h = (n: number) => formatearHoras(n, cfg.formatoHoras);

  const casos = (() => {
    const t = texto.trim().toLowerCase();
    const lista = casosDelPeriodo(regs, cfg).filter(
      (f) => !t || [f.caso, f.cliente, f.titulo, f.consultores.join(' '), f.estado, f.sinCaso ? 'sin caso' : ''].join(' ').toLowerCase().includes(t),
    );
    const dir = orden.asc ? 1 : -1;
    return lista.sort((a, b) => {
      const va = valorColumna(a, orden.col);
      const vb = valorColumna(b, orden.col);
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es')) * dir;
    });
  })();

  const ordenarPor = (col: Columna) => setOrden((o) => ({ col, asc: o.col === col ? !o.asc : col !== 'horas' }));
  const marca = (col: Columna) => (orden.col === col ? (orden.asc ? ' ▲' : ' ▼') : '');
  const ariaOrden = (col: Columna) => (orden.col === col ? (orden.asc ? 'ascending' : 'descending') : 'none');

  function exportar() {
    exportarExcel(`Casos_${rango.desde}_al_${rango.hasta}.xlsx`, 'Casos', [
      ['Caso', 'Cliente', 'Título', 'Consultor(es)', 'Último estado', 'Horas', 'Registros'],
      ...casos.map((f) => [f.sinCaso ? 'Sin caso' : f.caso, f.cliente, f.titulo, f.consultores.join(', '), estadoSinPrefijo(f.estado), f.horas, f.registros]),
    ]);
  }

  const esDia = periodo.modo === 'dia';

  return (
    <>
      <header>
        <h1>{esDia ? 'Tablero diario' : 'Tablero semanal'}</h1>
        <p className="subtitulo">{p.textoLectura} · {formatearNumero(registros.length)} registros en total</p>
      </header>

      <div className="controles">
        <div className="segmentado" role="group" aria-label="Vista">
          <button aria-pressed={esDia} onClick={() => p.onPeriodo({ modo: 'dia', ancla: esFinDeSemana(periodo.ancla) ? lunesDe(periodo.ancla) : periodo.ancla })}>Diario</button>
          <button aria-pressed={!esDia} onClick={() => p.onPeriodo({ modo: 'semana', ancla: periodo.ancla })}>Semanal</button>
        </div>
        <div className="periodo">
          <button aria-label={esDia ? 'Día anterior' : 'Semana anterior'} onClick={() => p.onPeriodo(moverPeriodo(periodo, -1))}>‹</button>
          <span className="etiqueta" aria-live="polite">{etiquetaPeriodo(periodo)}</span>
          <button aria-label={esDia ? 'Día siguiente' : 'Semana siguiente'} onClick={() => p.onPeriodo(moverPeriodo(periodo, 1))}>›</button>
        </div>
        <MultiSelect etiqueta="Cliente" opciones={valoresUnicos(registros, 'cliente')} seleccion={clientes} onCambio={setClientes} />
        <MultiSelect etiqueta="Consultor" opciones={valoresUnicos(registros, 'consultor')} seleccion={consultores} onCambio={setConsultores} />
        <button className="btn" onClick={p.onActualizar}>Actualizar</button>
      </div>

      {fuera > 0 && <p className="nota" role="status">{h(fuera)} registradas fuera de lun–vie (no suman en los totales).</p>}

      <section className="indicadores" aria-label="Indicadores">
        <div className="indicador">
          <div className="rotulo">Horas registradas</div>
          <div className="valor">{h(ind.horas)}</div>
          <div className="detalle">{ind.consultores} consultor{ind.consultores === 1 ? '' : 'es'} · {cfg.sumarFinDeSemana ? 'lun a dom' : 'lun a vie'}</div>
        </div>
        <div className="indicador">
          <div className="rotulo">Casos trabajados</div>
          <div className="valor">{ind.casos}</div>
          <div className="detalle">{ind.registros} registros</div>
        </div>
        <div className="indicador">
          <div className="rotulo">Clientes atendidos</div>
          <div className="valor">{ind.clientes}</div>
          <div className="detalle">{ind.clienteTop ? `${ind.clienteTop.nombre} concentra el ${ind.clienteTop.porcentaje} %` : 'Sin datos'}</div>
        </div>
        <button className="indicador alerta" onClick={p.onVerRevision}>
          <div className="rotulo">Registros a revisar</div>
          <div className="valor">{revision.total}</div>
          <div className="detalle">{revision.habiles} en días hábiles · {revision.finDeSemana} en fin de semana</div>
        </button>
      </section>

      <section className="graficas">
        <div className="tarjeta">
          <h2>Horas por cliente</h2>
          <BarrasHorizontales datos={sumarPor(regs, 'cliente')} formato={cfg.formatoHoras} />
        </div>
        <div className="tarjeta">
          <h2>Horas por tipo de servicio</h2>
          <BarrasHorizontales datos={sumarPor(regs, 'tipo')} formato={cfg.formatoHoras} />
        </div>
      </section>

      <section className="tarjeta">
        <h2>Horas por consultor y día</h2>
        {calor.filas.length === 0 ? (
          <p className="vacio">Sin registros en este periodo.</p>
        ) : (
          <div className="envoltura">
            <table className="calor">
              <thead>
                <tr>
                  <th scope="col">Consultor</th>
                  {dias.map((d) => <th scope="col" className="num" key={d}>{etiquetaDiaCorta(d)}</th>)}
                  <th scope="col" className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {calor.filas.map((f) => (
                  <tr key={f.consultor}>
                    <th scope="row" style={{ color: 'inherit', fontWeight: 500 }}>{f.consultor}</th>
                    {f.porDia.map((v, i) => {
                      const larga = esLarga(f.consultor, dias[i]!);
                      const alfa = Math.min(v / (cfg.jornadaLarga || 10), 1) * 0.28;
                      return (
                        <td key={dias[i]} className={`celda${larga ? ' larga' : ''}`} style={larga || v === 0 ? undefined : { background: `rgba(31,95,191,${alfa})` }}
                          title={larga ? `Jornada larga (≥ ${cfg.jornadaLarga} h)` : undefined}>
                          {v === 0 ? '–' : h(v)}{larga && <span className="sr-only"> jornada larga</span>}
                        </td>
                      );
                    })}
                    <td className="num"><strong>{h(f.total)}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  {calor.totalesDia.map((v, i) => <td className="num" key={dias[i]}>{h(v)}</td>)}
                  <td className="num">{h(calor.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {largas.length > 0 && <p className="subtitulo">En naranja: jornadas de {cfg.jornadaLarga} h o más.</p>}
      </section>

      <section className="tarjeta">
        <div className="cabecera-tabla">
          <h2>{esDia ? 'Casos del día' : 'Casos de la semana'} ({casos.length})</h2>
          <div className="controles">
            <input type="search" aria-label="Filtrar casos" placeholder="Filtrar por texto…" value={texto} onChange={(e) => setTexto(e.target.value)} />
            <button className="btn" onClick={exportar} disabled={casos.length === 0}>Exportar a Excel</button>
          </div>
        </div>
        <div className="envoltura">
          <table>
            <thead>
              <tr>
                {COLUMNAS.map((c) => (
                  <th key={c.id} scope="col" className={c.num ? 'num' : ''} aria-sort={ariaOrden(c.id)}>
                    <button onClick={() => ordenarPor(c.id)}>{c.titulo}{marca(c.id)}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {casos.map((f) => (
                <tr key={f.clave}>
                  <td className="mono">
                    {f.sinCaso ? <span className="insignia">Sin caso</span> : <button className="enlace" onClick={() => p.onVerCaso(f.caso)}>{f.caso}</button>}
                  </td>
                  <td>{f.cliente}</td>
                  <td>{f.titulo || '—'}</td>
                  <td>{f.consultores.join(', ')}</td>
                  <td>{f.estado ? <span className={`pildora${/solucionad/i.test(f.estado) ? ' ok' : ''}`}>{estadoSinPrefijo(f.estado)}</span> : <em style={{ color: 'var(--alerta-texto)' }}>vacío</em>}</td>
                  <td className="num">{h(f.horas)}</td>
                </tr>
              ))}
              {casos.length === 0 && <tr><td colSpan={6} className="vacio">No hay casos para mostrar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
