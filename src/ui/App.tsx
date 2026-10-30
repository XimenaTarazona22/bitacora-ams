import { useMemo, useState } from 'react';
import { textoLectura } from '../almacenamiento/archivo';
import { filtrar } from '../dominio/agregaciones';
import { aplicarAlias } from '../dominio/alias';
import { aplicarTecnologia } from '../dominio/control';
import { type Periodo, hoyISO, periodoInicial, rangoCompleto } from '../dominio/periodos';
import { evaluarAlertas, resumenRevision } from '../dominio/reglas';
import type { Registro } from '../dominio/tipos';
import { Buscar } from './Buscar';
import { Conexion } from './Conexion';
import { Configuracion } from './Configuracion';
import { Informe, type PresetInforme } from './Informe';
import { Lateral, type Vista } from './Lateral';
import { Revisar } from './Revisar';
import { Tablero } from './Tablero';
import { useBitacora, useControl } from './useBitacora';
import { useConfig } from './useConfig';
import './estilos.css';

const SIN_REGISTROS: Registro[] = [];

export function App() {
  const b = useBitacora();
  const control = useControl();
  const [vista, setVista] = useState<Vista>('tablero');
  const { cfg, setCfg, logo, setLogo } = useConfig();
  const [periodoUsuario, setPeriodo] = useState<Periodo | null>(null);
  const [caso, setCaso] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetInforme | null>(null);

  const brutos = b.resultado?.registros ?? SIN_REGISTROS;
  const tecnologias = control.resultado?.tecnologias ?? null;
  const hayTecnologia = tecnologias !== null;
  const registros = useMemo(
    () => aplicarTecnologia(aplicarAlias(brutos, cfg.aliasClientes), tecnologias),
    [brutos, cfg.aliasClientes, tecnologias],
  );
  const alertas = useMemo(() => evaluarAlertas(registros, cfg, hayTecnologia), [registros, cfg, hayTecnologia]);
  // Actualizar vuelve a leer la bitácora y, si está conectado, el Control.
  const actualizarTodo = () => {
    void b.actualizar();
    if (control.estado === 'listo') void control.actualizar();
  };
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
      <Lateral vista={vista} onVista={setVista} aRevisar={aRevisar} b={b} control={control} onActualizar={actualizarTodo} />
      <main className="contenido">
        {vista === 'tablero' ? (
          <Tablero
            registros={registros}
            alertas={alertas}
            cfg={cfg}
            periodo={periodo}
            onPeriodo={setPeriodo}
            textoLectura={textoLectura(b.leidoEn, registros.length).replace(/ · .*$/, '')}
            onActualizar={actualizarTodo}
            hayTecnologia={hayTecnologia}
            onVerRevision={() => setVista('revisar')}
            onVerCaso={(c) => { setCaso(c); setVista('buscar'); }}
          />
        ) : vista === 'buscar' ? (
          <Buscar
            registros={registros} cfg={cfg} periodo={periodo} caso={caso} onCaso={setCaso} hayTecnologia={hayTecnologia}
            onPdfCaso={(p) => { setPreset(p); setVista('informe'); }}
          />
        ) : vista === 'revisar' ? (
          <Revisar registros={registros} alertas={alertas} cfg={cfg} onCfg={setCfg} periodo={periodo} onPeriodo={setPeriodo} hayTecnologia={hayTecnologia} />
        ) : vista === 'config' ? (
          <Configuracion cfg={cfg} onCfg={setCfg} logo={logo} onLogo={setLogo} b={b} control={control} hayTecnologia={hayTecnologia} />
        ) : (
          <Informe registros={registros} cfg={cfg} logo={logo} periodo={periodo} preset={preset} onPresetUsado={() => setPreset(null)} hayTecnologia={hayTecnologia} />
        )}
      </main>
    </div>
  );
}
