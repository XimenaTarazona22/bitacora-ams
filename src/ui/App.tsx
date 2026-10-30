import { useMemo, useState } from 'react';
import { textoLectura } from '../almacenamiento/archivo';
import { filtrar } from '../dominio/agregaciones';
import { CONFIG_DEFECTO } from '../dominio/config';
import { type Periodo, hoyISO, periodoInicial, rangoCompleto } from '../dominio/periodos';
import { evaluarAlertas, resumenRevision } from '../dominio/reglas';
import type { Registro } from '../dominio/tipos';
import { Buscar } from './Buscar';
import { Conexion } from './Conexion';
import { Lateral, type Vista } from './Lateral';
import { Tablero } from './Tablero';
import { useBitacora } from './useBitacora';
import './estilos.css';

const SIN_REGISTROS: Registro[] = [];
const TITULOS: Record<Exclude<Vista, 'tablero' | 'buscar'>, string> = {
  informe: 'Informe para cliente',
  revisar: 'Registros a revisar',
  config: 'Configuración',
};

export function App() {
  const b = useBitacora();
  const [vista, setVista] = useState<Vista>('tablero');
  const [cfg] = useState(CONFIG_DEFECTO);
  const [periodoUsuario, setPeriodo] = useState<Periodo | null>(null);
  const [caso, setCaso] = useState<string | null>(null);

  const registros = b.resultado?.registros ?? SIN_REGISTROS;
  const alertas = useMemo(() => evaluarAlertas(registros, cfg), [registros, cfg]);
  const periodo = useMemo(
    () => periodoUsuario ?? periodoInicial(registros.flatMap((r) => (r.fecha ? [r.fecha] : [])), hoyISO()),
    [periodoUsuario, registros],
  );
  const aRevisar = useMemo(() => {
    const rango = rangoCompleto(periodo);
    const delPeriodo = filtrar(registros, { rango, clientes: [], consultores: [], incluirFinDeSemana: true });
    return resumenRevision(delPeriodo, alertas, rango).total;
  }, [registros, alertas, periodo]);

  if (!b.resultado || !b.leidoEn) return <Conexion b={b} />;

  return (
    <div className="app">
      <Lateral vista={vista} onVista={setVista} aRevisar={aRevisar} b={b} />
      <main className="contenido">
        {vista === 'tablero' ? (
          <Tablero
            registros={registros}
            alertas={alertas}
            cfg={cfg}
            periodo={periodo}
            onPeriodo={setPeriodo}
            textoLectura={textoLectura(b.leidoEn, registros.length).replace(/ · .*$/, '')}
            onActualizar={() => void b.actualizar()}
            onVerRevision={() => setVista('revisar')}
            onVerCaso={(c) => { setCaso(c); setVista('buscar'); }}
          />
        ) : vista === 'buscar' ? (
          <Buscar registros={registros} cfg={cfg} periodo={periodo} caso={caso} onCaso={setCaso} />
        ) : (
          <header>
            <h1>{TITULOS[vista]}</h1>
            <p className="subtitulo">Esta sección se construye en una fase posterior.</p>
          </header>
        )}
      </main>
    </div>
  );
}
