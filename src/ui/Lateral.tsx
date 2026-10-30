import { soportaFSA, textoLectura } from '../almacenamiento/archivo';
import type { useBitacora, useControl } from './useBitacora';

export type Vista = 'tablero' | 'buscar' | 'informe' | 'revisar' | 'config';

const NAV: { id: Vista; titulo: string }[] = [
  { id: 'tablero', titulo: 'Tablero' },
  { id: 'buscar', titulo: 'Buscar caso' },
  { id: 'informe', titulo: 'Informe para cliente' },
  { id: 'revisar', titulo: 'Registros a revisar' },
  { id: 'config', titulo: 'Configuración' },
];

interface Props {
  vista: Vista;
  onVista: (v: Vista) => void;
  aRevisar: number;
  b: ReturnType<typeof useBitacora>;
  control: ReturnType<typeof useControl>;
  onActualizar: () => void;
}

export function Lateral({ vista, onVista, aRevisar, b, control, onActualizar }: Props) {
  const estadoSync = b.estado === 'cargando' ? 'Leyendo…' : b.leidoEn && b.resultado ? textoLectura(b.leidoEn, b.resultado.registros.length) : '';
  return (
    <aside className="lateral">
      <div className="logo">
        <div className="logo-marca" aria-hidden="true">AMS</div>
        <div>
          <strong>Bitácora AMS</strong>
          <small>Informes de horas</small>
        </div>
      </div>
      <nav className="nav" aria-label="Secciones">
        {NAV.map((n) => (
          <button key={n.id} aria-current={vista === n.id ? 'page' : undefined} onClick={() => onVista(n.id)}>
            {n.titulo}
            {n.id === 'revisar' && aRevisar > 0 && <span className="contador" aria-label={`${aRevisar} registros por revisar`}>{aRevisar}</span>}
          </button>
        ))}
      </nav>
      <div className="fuente">
        <strong>Fuente de datos</strong>
        <span className="nombre">{b.nombre || 'Sin archivo'}</span>
        <span>{estadoSync}</span>
        {b.resultado && <span>{b.resultado.hojasConsultor.length} hojas de consultor</span>}
        {b.error && <span role="alert" style={{ color: '#ffd8a3' }}>{b.error}</span>}
        <span className="nombre" style={{ marginTop: 6 }}>Control: {control.nombre || 'sin conectar'}</span>
        {control.resultado && <span>{control.resultado.casos} casos con tecnología</span>}
        {control.error && <span role="alert" style={{ color: '#ffd8a3' }}>{control.error}</span>}
        {control.estado === 'requiere_permiso' && <button onClick={() => void control.conectar()}>Conectar Control</button>}
        {control.estado === 'sin_archivo' && <button onClick={() => (soportaFSA() ? void control.elegir() : onVista('config'))}>Conectar Control…</button>}
        <button onClick={onActualizar} disabled={b.estado === 'cargando' || control.estado === 'cargando'}>Actualizar</button>
      </div>
    </aside>
  );
}
