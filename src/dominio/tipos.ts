/** Un renglón de la bitácora ya normalizado. */
export interface Registro {
  hoja: string;
  fila: number;
  /** AAAA-MM-DD, o null si la fila no trae fecha válida. */
  fecha: string | null;
  cliente: string;
  consultor: string;
  tipo: string;
  /** Caso normalizado (ver normalizarCaso). */
  caso: string;
  /** Caso tal como vino en el Excel. */
  casoOriginal: string;
  titulo: string;
  apoyo: string;
  estado: string;
  /** Horas decimales del día (8,5 = 8:30), o null. */
  horaInicio: number | null;
  horaFin: number | null;
  /** Horas invertidas, redondeadas a 2 decimales. */
  horas: number;
  /** true si «Tiempo Invertido» venía vacío o inválido y se recalculó. */
  horasCalculadas: boolean;
  clasificacion: string;
  contratoAnterior: string;
  actividades: string;
}

export interface ResultadoLectura {
  registros: Registro[];
  /** Nombres de las hojas detectadas como de consultor. */
  hojasConsultor: string[];
  /** Hojas ignoradas por no tener el encabezado de la bitácora. */
  hojasIgnoradas: string[];
}

export type ClaseCaso = 'valido' | 'sin_caso' | 'no_reconocido';

export interface ConfigCasos {
  /** Valores (ya normalizados) que significan «sin número de caso». */
  sinCaso: string[];
  /** Expresiones regulares (texto) de casos válidos. */
  patrones: string[];
  /** Nombres aceptados como caso. */
  listaBlanca: string[];
}
