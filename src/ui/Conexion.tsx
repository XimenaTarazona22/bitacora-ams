import { useRef, useState, type DragEvent } from 'react';
import { soportaFSA } from '../almacenamiento/archivo';
import type { useBitacora } from './useBitacora';

type Bitacora = ReturnType<typeof useBitacora>;

/** Pantalla de inicio: conectar con la bitácora (selector, reconexión o arrastrar y soltar). */
export function Conexion({ b }: { b: Bitacora }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  function alSoltar(e: DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    const f = e.dataTransfer.files[0];
    if (f) void b.cargarArchivo(f);
  }

  return (
    <main className="bienvenida">
      <h1>Bitácora AMS</h1>
      <p className="subtitulo">Informes de horas a partir de la bitácora de servicios.</p>
      <div
        className={`soltar${arrastrando ? ' activo' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
      >
        {b.estado === 'iniciando' && <p>Buscando la bitácora…</p>}
        {b.estado === 'cargando' && <p role="status">Leyendo la bitácora…</p>}
        {b.estado === 'requiere_permiso' && <p>Última bitácora usada: <strong>{b.nombre}</strong></p>}
        {b.estado !== 'iniciando' && b.estado !== 'cargando' && (
          <div className="controles" style={{ justifyContent: 'center' }}>
            {b.estado === 'requiere_permiso' && (
              <button className="btn btn-primario" onClick={() => void b.conectar()}>Conectar con la bitácora</button>
            )}
            <button className={`btn${b.estado === 'requiere_permiso' ? '' : ' btn-primario'}`} onClick={() => (soportaFSA() ? void b.elegir() : entrada.current?.click())}>
              {b.estado === 'requiere_permiso' ? 'Elegir otro archivo…' : 'Elegir la bitácora…'}
            </button>
            {b.nombre && <button className="btn" onClick={() => void b.desconectar()}>Desconectar</button>}
          </div>
        )}
        <input
          ref={entrada}
          type="file"
          accept=".xlsx,.xlsm"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void b.cargarArchivo(f);
            e.target.value = '';
          }}
        />
        <p className="subtitulo">
          {soportaFSA() ? 'También puedes arrastrar el archivo .xlsx hasta aquí.' : 'Tu navegador no puede recordar el archivo: usa Edge o Chrome, o arrástralo hasta aquí.'}
        </p>
      </div>
      {b.error && <p role="alert" className="error">{b.error}</p>}
      {b.aviso && <p role="status" className="subtitulo">{b.aviso}</p>}
    </main>
  );
}
