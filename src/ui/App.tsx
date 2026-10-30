import { useMemo, useState } from 'react';
import { textoLectura } from '../almacenamiento/archivo';
import { filtrar } from '../dominio/agregaciones';
import { aplicarAlias } from '../dominio/alias';
import { type Periodo, hoyISO, periodoInicial, rangoCompleto } from '../dominio/periodos';
import { evaluarAlertas, resumenRevision } from '../dominio/reglas';
import type { Registro } from '../dominio/tipos';
import { Buscar } from './Buscar';
import { Conexion } from './Conexion';
import { Configuracion } from './Configuracion';
import { Lateral, type Vista } from './Lateral';
import { Revisar } from './Revisar';
import { Tablero } from './Tablero';
import { useBitacora } from './useBitacora';
import { useConfig } from './useConfig';
import './estilos.css';

const SIN_REGISTROS: Registro[] = [];
const TITULOS: Record<'informe', string> = { informe: 'Informe para cliente' };

export function App() {
  const b = useBitacora();
  const [vista, setVista] = useState<Vista>('tablero');
  const { cfg, setCfg, logo, setLogo } = useConfig();
  const [periodoUsuario, setPeriodo] = useState<Periodo | null>(null);
  const [caso, setCaso] = useState<string | null>(null);

  const brutos = b.resultado?.registros ?? SIN_REGISTROS;
  const registros = useMemo(() => aplicarAlias(brutos, cfg.aliasClientes), [brutos, cfg.aliasClientes]);
  const alertas = useMemo(() => evaluarAlertas(registros, cfg), [registros, cfg]);
  const periodo = useMemo(
    () => periodoUsuario ?? periodoInicial(registros.flatMap((r) => (r.fecha ? [r.fecha] : [])), hoyISO()),
    [periodoUsuario, registros],
  );
  const aRevisar = useMemo(() => {
    const rango = rangoCompleto(periodo);
    const delPeriodo = [...filtrar(registros, { rango, clientes: [], consultores: [], incluirFinDeSemana: true }), ...registros.filter((r) => !r.fecha)];
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
        ) : vista === 'revisar' ? (
          <Revisar registros={registros} alertas={alertas} cfg={cfg} onCfg={setCfg} periodo={periodo} onPeriodo={setPeriodo} />
        ) : vista === 'config' ? (
          <Configuracion cfg={cfg} onCfg={setCfg} logo={logo} onLogo={setLogo} b={b} />
        ) : (
          <header>
            <h1>{TITULOS.informe}</h1>
            <p className="subtitulo">Esta sección se construye en una fase posterior.</p>
          </header>
        )}
      </main>
    </div>
  );
}
