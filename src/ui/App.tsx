import { useRef, useState, type DragEvent } from 'react';
import { soportaFSA, textoLectura } from '../almacenamiento/archivo';
import { useBitacora } from './useBitacora';

const boton = { minHeight: 44, padding: '0 16px', cursor: 'pointer', marginRight: 8 } as const;

export function App() {
  const b = useBitacora();
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  function alSoltar(e: DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    const f = e.dataTransfer.files[0];
    if (f) void b.cargarArchivo(f);
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '48px auto', padding: 16 }}>
      <h1>Bitácora AMS · Informes de horas</h1>

      <div
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
        style={{ border: `2px dashed ${arrastrando ? '#1F5FBF' : '#DDE1E8'}`, borderRadius: 12, padding: 16 }}
      >
        {b.estado === 'iniciando' && <p>Buscando la bitácora…</p>}
        {b.estado === 'cargando' && <p role="status">Leyendo la bitácora…</p>}

        {b.estado === 'requiere_permiso' && (
          <p>
            Última bitácora usada: <strong>{b.nombre}</strong>
          </p>
        )}

        <div>
          {b.estado === 'requiere_permiso' && (
            <button style={boton} onClick={() => void b.conectar()}>Conectar con la bitácora</button>
          )}
          {b.estado === 'listo' && (
            <button style={boton} onClick={() => void b.actualizar()}>Actualizar</button>
          )}
          {(b.estado === 'sin_archivo' || b.estado === 'listo' || b.estado === 'requiere_permiso') &&
            (soportaFSA() ? (
              <button style={boton} onClick={() => void b.elegir()}>
                {b.estado === 'sin_archivo' ? 'Elegir la bitácora…' : 'Cambiar archivo…'}
              </button>
            ) : (
              <button style={boton} onClick={() => entrada.current?.click()}>Elegir la bitácora…</button>
            ))}
          {b.nombre && <button style={boton} onClick={() => void b.desconectar()}>Desconectar</button>}
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
        </div>
        <p style={{ color: '#555', fontSize: 14 }}>
          {soportaFSA() ? 'También puedes arrastrar el archivo .xlsx hasta aquí.' : 'Tu navegador no puede recordar el archivo: usa Edge o Chrome, o arrástralo hasta aquí.'}
        </p>
      </div>

      {b.error && <p role="alert" style={{ background: '#FFF4E5', color: '#7A3E00', padding: 12, borderRadius: 8 }}>{b.error}</p>}
      {b.aviso && <p role="status" style={{ color: '#555' }}>{b.aviso}</p>}

      {b.resultado && b.leidoEn && (
        <section aria-live="polite">
          <p>
            <strong>{b.nombre}</strong>: {b.resultado.hojasConsultor.length} hojas de consultor,{' '}
            {b.resultado.registros.length} registros
          </p>
          <p style={{ color: '#555' }}>{textoLectura(b.leidoEn, b.resultado.registros.length)}</p>
        </section>
      )}
    </main>
  );
}
