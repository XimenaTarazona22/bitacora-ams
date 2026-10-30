import { useCallback, useEffect, useState } from 'react';
import { cargarConfig, cargarLogo, guardarConfig, guardarLogo } from '../almacenamiento/config';
import { CONFIG_DEFECTO, type ConfigApp } from '../dominio/config';

/** Configuración y logo, persistidos en IndexedDB. No guarda nada hasta haber leído lo guardado. */
export function useConfig() {
  const [cfg, setCfgEstado] = useState<ConfigApp>(CONFIG_DEFECTO);
  const [logo, setLogoEstado] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    void Promise.all([cargarConfig(), cargarLogo()]).then(([c, l]) => {
      setCfgEstado(c);
      setLogoEstado(l);
      setListo(true);
    });
  }, []);

  const setCfg = useCallback((c: ConfigApp) => {
    setCfgEstado(c);
    if (listo) void guardarConfig(c);
  }, [listo]);

  const setLogo = useCallback((l: string | null) => {
    setLogoEstado(l);
    if (listo) void guardarLogo(l);
  }, [listo]);

  return { cfg, setCfg, logo, setLogo };
}
