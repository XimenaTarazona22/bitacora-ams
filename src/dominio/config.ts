import { CONFIG_CASOS_DEFECTO } from './normalizar';
import type { ConfigCasos, ReglaId } from './tipos';

export interface ConfigApp {
  casos: ConfigCasos;
  /** Si los registros de sábado y domingo suman en los totales (por defecto no). */
  sumarFinDeSemana: boolean;
  /** Horas por consultor y día a partir de las cuales la jornada se marca como larga. */
  jornadaLarga: number;
  formatoHoras: 'decimal' | 'hm';
  reglasActivas: Record<ReglaId, boolean>;
}

export const CONFIG_DEFECTO: ConfigApp = {
  casos: CONFIG_CASOS_DEFECTO,
  sumarFinDeSemana: false,
  jornadaLarga: 10,
  formatoHoras: 'decimal',
  reglasActivas: {
    sinCaso: true,
    sinEstado: true,
    sinActividades: true,
    casoNoReconocido: true,
    finDeSemana: true,
    horasInvalidas: true,
    franjaCruzada: true,
    sinFecha: true,
    jornadaLarga: true,
  },
};
