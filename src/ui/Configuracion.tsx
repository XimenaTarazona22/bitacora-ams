import { useRef, useState } from 'react';
import { soportaFSA } from '../almacenamiento/archivo';
import { interpretarConfig, leerLogo, serializarConfig } from '../almacenamiento/config';
import { type ConfigApp, patronValido } from '../dominio/config';
import { ETIQUETA_REGLA, ORDEN_REGLAS } from '../dominio/revision';
import type { useBitacora, useControl } from './useBitacora';

interface Props {
  cfg: ConfigApp;
  onCfg: (c: ConfigApp) => void;
  logo: string | null;
  onLogo: (l: string | null) => void;
  b: ReturnType<typeof useBitacora>;
  control: ReturnType<typeof useControl>;
  hayTecnologia: boolean;
}

const lineas = (t: string) => t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

/** Área de texto con una entrada por línea; aplica el cambio al salir del campo. */
function AreaLista({ id, titulo, ayuda, valor, onAplicar, error }: {
  id: string; titulo: string; ayuda: string; valor: string[]; onAplicar: (v: string[]) => void; error?: string;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);
  return (
    <div className="campo">
      <label htmlFor={id}>{titulo}</label>
      <textarea
        id={id}
        rows={Math.max(3, Math.min(8, valor.length + 1))}
        value={borrador ?? valor.join('\n')}
        aria-describedby={`${id}-ayuda`}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={() => { if (borrador !== null) { onAplicar(lineas(borrador)); setBorrador(null); } }}
      />
      <small id={`${id}-ayuda`} className="subtitulo">{ayuda}</small>
      {error && <small role="alert" className="error-campo">{error}</small>}
    </div>
  );
}

export function Configuracion({ cfg, onCfg, logo, onLogo, b, control, hayTecnologia }: Props) {
  const [mensaje, setMensaje] = useState('');
  const [errorLogo, setErrorLogo] = useState('');
  const entradaJson = useRef<HTMLInputElement>(null);
  const entradaControl = useRef<HTMLInputElement>(null);
  const [patronesMalos, setPatronesMalos] = useState<string[]>([]);

  const alias = Object.entries(cfg.aliasClientes).map(([k, v]) => `${k} = ${v}`);

  function aplicarPatrones(v: string[]) {
    setPatronesMalos(v.filter((p) => !patronValido(p)));
    onCfg({ ...cfg, casos: { ...cfg.casos, patrones: v.filter(patronValido) } });
  }

  function aplicarAlias(v: string[]) {
    const mapa: Record<string, string> = {};
    for (const l of v) {
      const [origen, ...resto] = l.split('=');
      const destino = resto.join('=').trim();
      if (origen?.trim() && destino) mapa[origen.trim()] = destino;
    }
    onCfg({ ...cfg, aliasClientes: mapa });
  }

  async function subirLogo(f: File | undefined) {
    if (!f) return;
    setErrorLogo('');
    try {
      onLogo(await leerLogo(f));
    } catch (e) {
      setErrorLogo(e instanceof Error ? e.message : String(e));
    }
  }

  function exportar() {
    const url = URL.createObjectURL(new Blob([serializarConfig(cfg, logo)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'configuracion-bitacora-ams.json' });
    a.click();
    URL.revokeObjectURL(url);
    setMensaje('Configuración exportada.');
  }

  async function importar(f: File | undefined) {
    if (!f) return;
    try {
      const r = interpretarConfig(await f.text());
      onCfg(r.config);
      onLogo(r.logo);
      setPatronesMalos([]);
      setMensaje('Configuración importada.');
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : String(e));
    }
  }

  const pdf = (parcial: Partial<ConfigApp['pdf']>) => onCfg({ ...cfg, pdf: { ...cfg.pdf, ...parcial } });

  return (
    <>
      <header>
        <h1>Configuración</h1>
        <p className="subtitulo">Los cambios se guardan automáticamente en este navegador.</p>
      </header>

      <section className="tarjeta" aria-labelledby="cfg-archivo">
        <h2 id="cfg-archivo">Archivo conectado</h2>
        <p>{b.nombre ? <><strong>{b.nombre}</strong>{b.resultado && ` · ${b.resultado.hojasConsultor.length} hojas de consultor, ${b.resultado.registros.length} registros`}</> : 'Sin archivo conectado.'}</p>
        <div className="controles">
          <button className="btn" onClick={() => void b.elegir()}>Cambiar archivo…</button>
          <button className="btn" onClick={() => void b.desconectar()} disabled={!b.nombre}>Desconectar</button>
        </div>
      </section>

      {b.resultado && (
        <section className="tarjeta" aria-labelledby="cfg-hojas">
          <h2 id="cfg-hojas">Hojas de consultor leídas</h2>
          <p className="subtitulo" style={{ marginTop: 0 }}>
            Cada hoja cuyo encabezado empieza por «Fecha» se lee sola; un consultor nuevo aparece aquí sin configurar nada.
            Desmarque una hoja para no usarla (por ejemplo, una de prueba).
          </p>
          {b.resultado.hojasExcluidas.length > 0 && (
            <p className="nota" role="status">
              Se saltó la hoja consolidada «{b.resultado.hojasExcluidas.join('», «')}»: repite los registros de las demás hojas y duplicaría las horas.
            </p>
          )}
          {b.resultado.hojasTruncadas.length > 0 && (
            <p role="alert" className="error">
              Hay registros más allá de la fila 60.000 en: {b.resultado.hojasTruncadas.join(', ')}. No se leyeron.
            </p>
          )}
          <div className="reglas">
            {b.resultado.hojas.map((h) => (
              <label key={h.nombre} className="casilla">
                <input
                  type="checkbox"
                  checked={!cfg.hojasExcluidas.includes(h.nombre)}
                  onChange={(e) =>
                    onCfg({ ...cfg, hojasExcluidas: e.target.checked ? cfg.hojasExcluidas.filter((x) => x !== h.nombre) : [...cfg.hojasExcluidas, h.nombre] })
                  }
                />
                {h.nombre} ({h.registros.toLocaleString('es-CO')} registros)
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="tarjeta" aria-labelledby="cfg-control">
        <h2 id="cfg-control">Control seguimiento AMS (tecnología)</h2>
        <p className="subtitulo" style={{ marginTop: 0 }}>
          Opcional. De este archivo solo se lee el número de caso y la tecnología, y se cruzan con la bitácora por número de caso.
        </p>
        <p>
          {control.nombre ? <strong>{control.nombre}</strong> : 'Sin archivo conectado.'}
          {control.resultado && ` · hoja «${control.resultado.hoja}», ${control.resultado.casos} casos con tecnología`}
        </p>
        {control.resultado && control.resultado.conflictos.length > 0 && (
          <p className="nota" role="status">
            {control.resultado.conflictos.length} caso(s) aparecen con más de una tecnología (se usa la primera):{' '}
            {control.resultado.conflictos.slice(0, 5).map((c) => `${c.caso} (${c.tecnologias.join(' / ')})`).join(', ')}
            {control.resultado.conflictos.length > 5 && '…'}
          </p>
        )}
        {control.error && <p role="alert" className="error">{control.error}</p>}
        {control.aviso && <p role="status" className="subtitulo">{control.aviso}</p>}
        <div className="controles">
          {control.estado === 'requiere_permiso' && <button className="btn btn-primario" onClick={() => void control.conectar()}>Conectar Control</button>}
          <button className="btn" onClick={() => (soportaFSA() ? void control.elegir() : entradaControl.current?.click())}>{control.nombre ? 'Cambiar archivo…' : 'Elegir el Control…'}</button>
          <input
            ref={entradaControl} type="file" accept=".xlsx,.xlsm" hidden aria-label="Archivo Control seguimiento AMS"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void control.cargarArchivo(f); e.target.value = ''; }}
          />
          {control.estado === 'listo' && <button className="btn" onClick={() => void control.actualizar()}>Actualizar</button>}
          <button className="btn" onClick={() => void control.desconectar()} disabled={!control.nombre}>Desconectar</button>
        </div>
      </section>

      <section className="tarjeta" aria-labelledby="cfg-reglas">
        <h2 id="cfg-reglas">Reglas de negocio</h2>
        <div className="rejilla-cfg">
          <AreaLista
            id="cfg-sincaso" titulo="Valores que significan «sin número de caso»" valor={cfg.casos.sinCaso}
            ayuda="Uno por línea. El caso vacío siempre cuenta como sin caso."
            onAplicar={(v) => onCfg({ ...cfg, casos: { ...cfg.casos, sinCaso: v } })}
          />
          <AreaLista
            id="cfg-patrones" titulo="Patrones de caso válido (expresiones regulares)" valor={cfg.casos.patrones}
            ayuda="Uno por línea, sin distinguir mayúsculas. Ejemplo: ^\d+$"
            error={patronesMalos.length ? `Se ignoraron por inválidos: ${patronesMalos.join(', ')}` : undefined}
            onAplicar={aplicarPatrones}
          />
          <AreaLista
            id="cfg-blanca" titulo="Lista blanca de nombres aceptados como caso" valor={cfg.casos.listaBlanca}
            ayuda="Uno por línea. Ejemplo: Seguimiento ACH"
            onAplicar={(v) => onCfg({ ...cfg, casos: { ...cfg.casos, listaBlanca: v } })}
          />
          <AreaLista
            id="cfg-alias" titulo="Alias de clientes" valor={alias}
            ayuda="Uno por línea, con el formato «Nombre en la bitácora = Nombre a mostrar». Vacío: cada cliente se mantiene separado."
            onAplicar={aplicarAlias}
          />
        </div>

        <div className="rejilla-cfg" style={{ marginTop: 16 }}>
          <label className="casilla">
            <input type="checkbox" checked={cfg.sumarFinDeSemana} onChange={(e) => onCfg({ ...cfg, sumarFinDeSemana: e.target.checked })} />
            Sumar sábado y domingo en los totales
          </label>
          <div className="campo">
            <label htmlFor="cfg-jornada">Jornada larga desde (horas por consultor y día)</label>
            <input id="cfg-jornada" type="number" min={1} max={24} step={0.5} value={cfg.jornadaLarga}
              onChange={(e) => { const v = Number(e.target.value); if (v > 0) onCfg({ ...cfg, jornadaLarga: v }); }} />
          </div>
          <div className="campo">
            <label htmlFor="cfg-formato">Formato de horas</label>
            <select id="cfg-formato" value={cfg.formatoHoras} onChange={(e) => onCfg({ ...cfg, formatoHoras: e.target.value as ConfigApp['formatoHoras'] })}>
              <option value="decimal">Decimales (7,5 h)</option>
              <option value="hm">Horas y minutos (7:30)</option>
            </select>
          </div>
        </div>

        <h3>Reglas de validación activas</h3>
        <div className="reglas">
          {ORDEN_REGLAS.filter((t) => t !== 'sinTecnologia' || hayTecnologia).map((t) => (
            <label key={t} className="casilla">
              <input type="checkbox" checked={cfg.reglasActivas[t]}
                onChange={(e) => onCfg({ ...cfg, reglasActivas: { ...cfg.reglasActivas, [t]: e.target.checked } })} />
              {ETIQUETA_REGLA[t]}
            </label>
          ))}
        </div>
      </section>

      <section className="tarjeta" aria-labelledby="cfg-pdf">
        <h2 id="cfg-pdf">Datos para el PDF</h2>
        <div className="rejilla-cfg">
          <div className="campo">
            <label htmlFor="cfg-logo">Logo (PNG o JPG, máximo 1 MB)</label>
            <input id="cfg-logo" type="file" accept="image/png,image/jpeg" onChange={(e) => { void subirLogo(e.target.files?.[0]); e.target.value = ''; }} />
            {errorLogo && <small role="alert" className="error-campo">{errorLogo}</small>}
            {logo && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <img src={logo} alt="Vista previa del logo" style={{ maxHeight: 48, maxWidth: 160, border: '1px solid var(--borde)', padding: 4, borderRadius: 6 }} />
                <button className="btn" onClick={() => onLogo(null)}>Quitar logo</button>
              </div>
            )}
          </div>
          <div className="campo">
            <label htmlFor="cfg-empresa">Nombre de la empresa</label>
            <input id="cfg-empresa" type="text" value={cfg.pdf.empresa} onChange={(e) => pdf({ empresa: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="cfg-pie">Texto del pie de página</label>
            <input id="cfg-pie" type="text" value={cfg.pdf.pie} onChange={(e) => pdf({ pie: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="cfg-papel">Tamaño del papel</label>
            <select id="cfg-papel" value={cfg.pdf.papel} onChange={(e) => pdf({ papel: e.target.value as ConfigApp['pdf']['papel'] })}>
              <option value="carta">Carta</option>
              <option value="a4">A4</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="cfg-nombres">Nombres de consultores en el PDF</label>
            <select id="cfg-nombres" value={cfg.pdf.nombres} onChange={(e) => pdf({ nombres: e.target.value as ConfigApp['pdf']['nombres'] })}>
              <option value="inicial">Inicial y apellido (C. Trujillo)</option>
              <option value="completo">Nombre completo (Camilo Trujillo)</option>
            </select>
          </div>
        </div>
      </section>

      <section className="tarjeta" aria-labelledby="cfg-json">
        <h2 id="cfg-json">Exportar e importar configuración</h2>
        <p className="subtitulo" style={{ marginTop: 0 }}>Un archivo JSON con las reglas, los datos del PDF y el logo, para llevarlo a otro equipo.</p>
        <div className="controles">
          <button className="btn" onClick={exportar}>Exportar configuración</button>
          <button className="btn" onClick={() => entradaJson.current?.click()}>Importar configuración…</button>
          <input ref={entradaJson} type="file" accept=".json,application/json" hidden onChange={(e) => { void importar(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {mensaje && <p role="status" className="subtitulo">{mensaje}</p>}
      </section>
    </>
  );
}
