import { useEffect, useMemo, useRef, useState } from 'react';
import { cargarResumenes, guardarResumenes } from '../almacenamiento/resumenes';
import type { ConfigApp } from '../dominio/config';
import { formatearHoras } from '../dominio/formato';
import {
  type OpcionesInforme, CONTENIDO_DEFECTO, claveResumen, clientesDelPeriodo, construirInforme, nombreArchivoInforme,
  opcionesPorDefecto, separarCodigos, verificarInforme,
} from '../dominio/informe';
import { type Periodo, type Rango, etiquetaLarga, hoyISO, rangoCompleto, semanaLV } from '../dominio/periodos';
import type { Registro } from '../dominio/tipos';
import { crearPdf, empaquetarZip } from '../pdf/informeCliente';
import { descargarBlob } from './descargar';

export interface PresetInforme {
  cliente: string;
  caso: string;
  rango: Rango;
}

interface Props {
  registros: Registro[];
  cfg: ConfigApp;
  logo: string | null;
  periodo: Periodo;
  preset: PresetInforme | null;
  onPresetUsado: () => void;
}

type ModoPeriodo = 'semana' | 'dia' | 'rango';
const ETIQUETAS_CONTENIDO: [keyof typeof CONTENIDO_DEFECTO, string][] = [
  ['horasPorCaso', 'Horas por caso'],
  ['acumulado', 'Horas acumuladas desde el inicio'],
  ['resumen', 'Resumen de actividades'],
  ['detallePorDia', 'Detalle por día'],
  ['consultor', 'Nombre del consultor'],
  ['grafica', 'Gráfica de horas por día'],
];

function Opcion({ nombre, valor, actual, onChange, texto }: { nombre: string; valor: string; actual: string; onChange: (v: never) => void; texto: string }) {
  return (
    <label className="casilla"><input type="radio" name={nombre} checked={actual === valor} onChange={() => onChange(valor as never)} />{texto}</label>
  );
}

export function Informe({ registros, cfg, logo, periodo, preset, onPresetUsado }: Props) {
  const [modo, setModo] = useState<ModoPeriodo>(periodo.modo === 'dia' ? 'dia' : 'semana');
  const [fecha1, setFecha1] = useState(periodo.ancla);
  const [fecha2, setFecha2] = useState(periodo.ancla);
  const [cliente, setCliente] = useState('');
  const [casos, setCasos] = useState<'todos' | 'solicitados'>('todos');
  const [solicitados, setSolicitados] = useState<string[]>([]);
  const [entrada, setEntrada] = useState('');
  const [contenido, setContenido] = useState({ ...CONTENIDO_DEFECTO });
  const [sinCaso, setSinCaso] = useState<'agrupar' | 'excluir'>('agrupar');
  const [finDeSemana, setFinDeSemana] = useState<'incluir' | 'excluir'>(cfg.sumarFinDeSemana ? 'incluir' : 'excluir');
  const [sinEstado, setSinEstado] = useState<'incluir' | 'excluir'>('incluir');
  const [nota, setNota] = useState('');
  const [ediciones, setEdiciones] = useState<Record<string, string>>({});
  const [edicionesListas, setEdicionesListas] = useState(false);
  const [urlVista, setUrlVista] = useState('');
  const [estado, setEstado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const urlAnterior = useRef('');

  const rango: Rango = useMemo(
    () => (modo === 'semana' ? semanaLV(fecha1) : modo === 'dia' ? { desde: fecha1, hasta: fecha1 } : fecha1 <= fecha2 ? { desde: fecha1, hasta: fecha2 } : { desde: fecha2, hasta: fecha1 }),
    [modo, fecha1, fecha2],
  );
  const rangoConFin = modo === 'semana' ? rangoCompleto({ modo: 'semana', ancla: fecha1 }) : rango;
  const h = (n: number) => formatearHoras(n, cfg.formatoHoras);

  useEffect(() => {
    void cargarResumenes().then((r) => { setEdiciones(r); setEdicionesListas(true); });
  }, []);

  // Viene de «PDF de este caso»: cliente, caso y todo el periodo trabajado.
  useEffect(() => {
    if (!preset) return;
    setCliente(preset.cliente);
    setCasos('solicitados');
    setSolicitados([preset.caso]);
    setModo('rango');
    setFecha1(preset.rango.desde);
    setFecha2(preset.rango.hasta);
    onPresetUsado();
  }, [preset, onPresetUsado]);

  const clientes = useMemo(() => clientesDelPeriodo(registros, rangoConFin, true), [registros, rangoConFin]);
  const clienteActivo = clientes.includes(cliente) ? cliente : clientes[0] ?? '';

  const opciones: OpcionesInforme = useMemo(
    () => ({ ...opcionesPorDefecto(clienteActivo, rango, cfg), casos, solicitados, contenido, sinCaso, finDeSemana, sinEstado, nota }),
    [clienteActivo, rango, cfg, casos, solicitados, contenido, sinCaso, finDeSemana, sinEstado, nota],
  );
  const informe = useMemo(
    () => construirInforme(registros, cfg, opciones, ediciones, hoyISO()),
    [registros, cfg, opciones, ediciones],
  );
  const totalCasos = useMemo(() => construirInforme(registros, cfg, { ...opciones, casos: 'todos' }, {}, hoyISO()).casos, [registros, cfg, opciones]);
  const verif = useMemo(() => verificarInforme(registros, cfg, clienteActivo, rangoConFin), [registros, cfg, clienteActivo, rangoConFin]);

  // Vista previa: se regenera (con una pausa corta) al cambiar cualquier opción.
  useEffect(() => {
    if (!clienteActivo) { setUrlVista(''); return; }
    let vigente = true;
    const t = setTimeout(() => {
      crearPdf(informe, cfg, logo).then((blob) => {
        if (!vigente) return;
        const url = URL.createObjectURL(blob);
        if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current);
        urlAnterior.current = url;
        setUrlVista(url);
      }).catch((e) => vigente && setEstado(`No se pudo generar la vista previa: ${e instanceof Error ? e.message : String(e)}`));
    }, 350);
    return () => { vigente = false; clearTimeout(t); };
  }, [informe, cfg, logo, clienteActivo]);
  useEffect(() => () => { if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current); }, []);

  function agregarCodigos(texto: string) {
    const nuevos = separarCodigos(texto);
    if (nuevos.length) setSolicitados((s) => [...new Set([...s, ...nuevos])]);
  }

  function alEscribirCodigos(v: string) {
    if (/[\s,;]/.test(v)) { agregarCodigos(v); setEntrada(''); } else setEntrada(v);
  }

  function editarResumen(clave: string, valor: string, borrador: string) {
    const siguiente = { ...ediciones };
    if (valor === borrador) delete siguiente[clave]; else siguiente[clave] = valor;
    setEdiciones(siguiente);
    if (edicionesListas) void guardarResumenes(siguiente);
  }

  async function descargar() {
    setOcupado(true);
    setEstado('');
    try {
      descargarBlob(await crearPdf(informe, cfg, logo), nombreArchivoInforme(clienteActivo, rango));
    } catch (e) {
      setEstado(`No se pudo generar el PDF: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setOcupado(false);
    }
  }

  async function descargarTodos() {
    setOcupado(true);
    setEstado('');
    try {
      const lista = clientesDelPeriodo(registros, rango, finDeSemana === 'incluir');
      const generados: { informe: ReturnType<typeof construirInforme>; blob: Blob }[] = [];
      for (const c of lista) {
        setEstado(`Generando ${generados.length + 1} de ${lista.length}: ${c}…`);
        // Un PDF por cliente: todos sus casos, con las mismas opciones de contenido y verificación.
        const i = construirInforme(registros, cfg, { ...opciones, cliente: c, casos: 'todos', solicitados: [] }, ediciones, hoyISO());
        generados.push({ informe: i, blob: await crearPdf(i, cfg, logo) });
      }
      descargarBlob(await empaquetarZip(generados), `Informes_horas_${rango.desde}_al_${rango.hasta}.zip`);
      setEstado(`Listo: ${generados.length} informes en el .zip.`);
    } catch (e) {
      setEstado(`No se pudo generar el .zip: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setOcupado(false);
    }
  }

  const hayAvisos = verif.horasSinCaso > 0 || verif.horasFinDeSemana > 0 || verif.registrosSinEstado > 0;

  return (
    <>
      <header>
        <h1>Informe para cliente</h1>
        <p className="subtitulo">Arma el PDF de horas por caso, revisa la vista previa y descárgalo.</p>
      </header>

      <div className="informe">
        <div className="informe-form">
          <section className="tarjeta" aria-labelledby="inf-datos">
            <h2 id="inf-datos">Cliente y periodo</h2>
            <div className="campo">
              <label htmlFor="inf-cliente">Cliente</label>
              <select id="inf-cliente" value={clienteActivo} onChange={(e) => setCliente(e.target.value)}>
                {clientes.length === 0 && <option value="">Sin clientes con horas en el periodo</option>}
                {clientes.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <fieldset className="grupo">
              <legend>Periodo</legend>
              <div className="controles">
                <Opcion nombre="modo" valor="semana" actual={modo} onChange={setModo} texto="Semana (lun–vie)" />
                <Opcion nombre="modo" valor="dia" actual={modo} onChange={setModo} texto="Día" />
                <Opcion nombre="modo" valor="rango" actual={modo} onChange={setModo} texto="Rango" />
              </div>
              <div className="controles">
                <div className="campo">
                  <label htmlFor="inf-f1">{modo === 'rango' ? 'Desde' : modo === 'dia' ? 'Día' : 'Cualquier día de la semana'}</label>
                  <input id="inf-f1" type="date" value={fecha1} onChange={(e) => e.target.value && setFecha1(e.target.value)} />
                </div>
                {modo === 'rango' && (
                  <div className="campo">
                    <label htmlFor="inf-f2">Hasta</label>
                    <input id="inf-f2" type="date" value={fecha2} min={fecha1} onChange={(e) => e.target.value && setFecha2(e.target.value)} />
                  </div>
                )}
              </div>
              <p className="subtitulo" style={{ margin: 0 }}>{etiquetaLarga(rango)}</p>
            </fieldset>
          </section>

          <section className="tarjeta" aria-labelledby="inf-casos">
            <h2 id="inf-casos">Casos a incluir</h2>
            <Opcion nombre="casos" valor="todos" actual={casos} onChange={setCasos} texto={`Todos los casos del cliente en el periodo (${totalCasos})`} />
            <Opcion nombre="casos" valor="solicitados" actual={casos} onChange={setCasos} texto="Solo los casos que pidió el cliente" />
            {casos === 'solicitados' && (
              <div className="campo">
                <label htmlFor="inf-codigos">Códigos de caso (pega varios, separados por coma, espacio o salto de línea)</label>
                <ul className="chips" aria-label="Casos pedidos">
                  {solicitados.map((c) => (
                    <li key={c}>
                      <span className="mono">{c}</span>
                      <button aria-label={`Quitar ${c}`} onClick={() => setSolicitados(solicitados.filter((x) => x !== c))}>×</button>
                    </li>
                  ))}
                </ul>
                <textarea id="inf-codigos" rows={2} value={entrada} placeholder="TASK0050017, PRB0043331…"
                  onChange={(e) => alEscribirCodigos(e.target.value)} onBlur={() => { agregarCodigos(entrada); setEntrada(''); }}
                  onPaste={(e) => { e.preventDefault(); agregarCodigos(e.clipboardData.getData('text')); }} />
                {informe.noEncontrados.length > 0 && (
                  <p role="alert" className="nota">No aparecen en este periodo para {clienteActivo}: {informe.noEncontrados.join(', ')}.</p>
                )}
              </div>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="inf-contenido">
            <h2 id="inf-contenido">Contenido del PDF</h2>
            <div className="reglas">
              {ETIQUETAS_CONTENIDO.map(([k, t]) => (
                <label className="casilla" key={k}>
                  <input type="checkbox" checked={contenido[k]} onChange={(e) => setContenido({ ...contenido, [k]: e.target.checked })} />
                  {t}
                </label>
              ))}
            </div>
          </section>

          {hayAvisos && (
            <section className="nota" aria-labelledby="inf-verif">
              <h2 id="inf-verif" style={{ color: 'inherit' }}>Verificación previa</h2>
              {verif.horasSinCaso > 0 && casos === 'todos' && (
                <fieldset className="grupo">
                  <legend>{clienteActivo} tiene {h(verif.horasSinCaso)} en el periodo sin número de caso ({verif.registrosSinCaso} registros).</legend>
                  <Opcion nombre="sincaso" valor="agrupar" actual={sinCaso} onChange={setSinCaso} texto="Agrupar como «Actividades generales»" />
                  <Opcion nombre="sincaso" valor="excluir" actual={sinCaso} onChange={setSinCaso} texto="Excluir del informe" />
                </fieldset>
              )}
              {verif.horasFinDeSemana > 0 && (
                <fieldset className="grupo">
                  <legend>Hay {h(verif.horasFinDeSemana)} registradas en sábado o domingo ({verif.registrosFinDeSemana} registros).</legend>
                  <Opcion nombre="finde" valor="excluir" actual={finDeSemana} onChange={setFinDeSemana} texto="Excluir del informe" />
                  <Opcion nombre="finde" valor="incluir" actual={finDeSemana} onChange={setFinDeSemana} texto="Incluir en el informe" />
                </fieldset>
              )}
              {verif.registrosSinEstado > 0 && (
                <fieldset className="grupo">
                  <legend>{verif.registrosSinEstado} registros ({h(verif.horasSinEstado)}) no tienen estado.</legend>
                  <Opcion nombre="sinestado" valor="incluir" actual={sinEstado} onChange={setSinEstado} texto="Incluirlos (el estado se muestra con —)" />
                  <Opcion nombre="sinestado" valor="excluir" actual={sinEstado} onChange={setSinEstado} texto="Excluirlos del informe" />
                </fieldset>
              )}
            </section>
          )}

          {contenido.resumen && informe.filas.length > 0 && (
            <section className="tarjeta" aria-labelledby="inf-resumen">
              <h2 id="inf-resumen">Resumen por caso (editable)</h2>
              <p className="subtitulo" style={{ marginTop: 0 }}>Borrador a partir de las actividades registradas, sin saludos ni firmas. Tus cambios se guardan por cliente, caso y periodo.</p>
              {informe.filas.map((f) => {
                const clave = claveResumen(clienteActivo, f.clave, rango);
                const editado = f.resumen !== f.resumenBorrador;
                return (
                  <div className="campo" key={f.clave} style={{ marginBottom: 12 }}>
                    <label htmlFor={`res-${f.clave}`}>
                      <span className="mono">{f.general ? 'Actividades generales' : f.caso}</span> · {h(f.horas)}
                      {f.descripcion && !f.general && <span className="subtitulo"> — {f.descripcion}</span>}
                    </label>
                    <textarea id={`res-${f.clave}`} rows={4} value={f.resumen} onChange={(e) => editarResumen(clave, e.target.value, f.resumenBorrador)} />
                    <div className="subtitulo">
                      {f.resumen.length} caracteres
                      {editado && <> · <button className="enlace" onClick={() => editarResumen(clave, f.resumenBorrador, f.resumenBorrador)}>Restaurar borrador</button></>}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          <section className="tarjeta" aria-labelledby="inf-nota">
            <h2 id="inf-nota">Nota para el cliente (opcional)</h2>
            <textarea aria-labelledby="inf-nota" rows={3} value={nota} onChange={(e) => setNota(e.target.value)} style={{ width: '100%', border: '1px solid var(--borde)', borderRadius: 8, padding: '8px 12px' }} />
          </section>

          <div className="controles">
            <button className="btn btn-primario" onClick={() => void descargar()} disabled={ocupado || !clienteActivo}>Descargar PDF</button>
            <button className="btn" onClick={() => void descargarTodos()} disabled={ocupado || clientes.length === 0}>Generar para todos los clientes</button>
          </div>
          {estado && <p role="status" className="subtitulo">{estado}</p>}
        </div>

        <aside className="informe-vista" aria-label="Vista previa del PDF">
          {urlVista ? (
            <iframe title="Vista previa del informe" src={urlVista} />
          ) : (
            <p className="vacio">{clienteActivo ? 'Generando la vista previa…' : 'No hay clientes con horas en este periodo.'}</p>
          )}
        </aside>
      </div>
    </>
  );
}

