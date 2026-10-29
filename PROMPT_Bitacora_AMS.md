# Proyecto: Bitácora AMS – App local de informes de horas

## Rol y forma de trabajo

Eres el desarrollador de este proyecto. Vas a construir, de principio a fin, una aplicación web local que lee la bitácora de horas de los consultores (un libro de Excel en OneDrive) y genera tableros, búsquedas por caso, alertas de calidad de datos e informes PDF para clientes.

Trabaja así:
1. Antes de escribir código, lee todo este documento, inspecciona el Excel de muestra (si está en `muestras/`) y propónme un plan breve por fases. Espera mi aprobación.
2. Crea un `CLAUDE.md` en la raíz con las decisiones clave de este documento (stack, reglas de negocio, estructura), para que las sesiones futuras las respeten.
3. Desarrolla por fases (sección «Fases»). Al terminar cada fase: corre las pruebas, haz un commit con un mensaje claro en español y muéstrame un resumen de lo hecho y cómo probarlo. Espera mi visto bueno antes de seguir con la siguiente.
4. Si algo de este documento es ambiguo o choca con lo que ves en el Excel real, pregúntame en vez de suponer.
5. Toda la interfaz, mensajes, comentarios para el usuario y documentación van en **español (Colombia)**.

## Contexto del negocio

- Somos una consultora de servicios AMS (soporte y evolutivos, principalmente PeopleSoft HCM/ERP).
- Existe **un solo libro de Excel** ("Bitácora Servicios AMS.xlsx") en el OneDrive/SharePoint de la empresa. Tiene **una hoja por consultor** (hay muchos consultores, y se agregan nuevos) donde cada uno registra su trabajo diario.
- Cada semana los clientes nos piden cuántas horas se invirtieron en ciertos casos. Hoy eso se arma a mano.
- **La bitácora no se puede modificar ni cambiar la forma en que se diligencia.** La app solo LEE el archivo.
- Restricciones fuertes: sin servidores, sin permisos especiales de TI, sin registrar apps en Microsoft 365/Azure, sin licencias adicionales, sin instalar nada en el equipo del usuario final. El usuario accede al archivo porque OneDrive lo sincroniza a una carpeta local de su computador.

## Qué se entrega (producto final)

1. **Un único archivo `BitacoraAMS.html`** autocontenido (todo el JS, CSS, fuentes e íconos incrustados) que el usuario abre con doble clic en **Microsoft Edge o Google Chrome**, sin conexión a internet y sin servidor.
2. Un `LEEME.md` para el usuario final (no técnico): cómo sincronizar la bitácora con OneDrive, cómo abrir la app, cómo generar un informe, preguntas frecuentes.
3. El código fuente en un repositorio git con pruebas automatizadas.

## Stack técnico

- **Vite + React + TypeScript** (modo estricto).
- **vite-plugin-singlefile** para producir el HTML único en `dist/`.
- **SheetJS (xlsx)** para leer el Excel. Instálalo desde el tarball oficial de SheetJS (`https://cdn.sheetjs.com/`), no la versión vieja del registro npm. Lee los valores calculados en caché de las fórmulas.
- **pdfmake** para generar los PDF en el navegador (tablas, saltos de página, encabezado/pie por página). Incrusta las fuentes.
- **JSZip** para descargar varios PDF juntos.
- Gráficas: **Recharts** (o SVG propio si es más liviano).
- Estilos: CSS propio o CSS Modules; nada que dependa de CDN.
- Pruebas: **Vitest** (lógica) y, si es viable, **Playwright** para una prueba de humo del HTML final.
- **Cero llamadas de red en tiempo de ejecución**: nada de CDN, analítica, telemetría ni fuentes remotas. Verifícalo.
- El procesamiento pesado (lectura y normalización del Excel) va en un **Web Worker** para no congelar la interfaz; el libro puede tener muchas hojas y miles de filas.

## Acceso al archivo (sin descargarlo manualmente)

- Usa la **File System Access API** (`showOpenFilePicker`) en Edge/Chrome: la primera vez el usuario elige el archivo dentro de su carpeta sincronizada de OneDrive.
- Guarda el `FileSystemFileHandle` en **IndexedDB**. En las siguientes aperturas, muestra un botón «Conectar con la bitácora» que llama a `requestPermission({mode:'read'})` (un clic) y lee la versión más reciente.
- Botón **«Actualizar»** que vuelve a leer el archivo y muestra «Datos leídos hoy h:mm a. m./p. m. · N registros».
- **Verifica que todo funcione abriendo el HTML desde `file://`** (doble clic). Si la persistencia del handle o IndexedDB no funcionan desde `file://`, degrada con elegancia: selector de archivo cada vez + arrastrar y soltar, y documéntalo en el LEEME.
- Fallback para navegadores sin la API: `<input type="file">` y arrastrar y soltar.
- Si el archivo no se puede leer (bloqueado, solo en la nube, formato inválido), muestra un mensaje claro con la causa probable. Recomienda en el LEEME marcar el archivo como «Mantener siempre en este dispositivo» en OneDrive.
- Nunca escribas en el archivo de origen.

## Estructura del Excel (hechos verificados en una copia real)

Hojas del libro:
- **Hojas de consultor**: su fila 1 es el encabezado y empieza por `Fecha`. Ejemplos: «Camilo T», «Edwin V». El nombre de la hoja suele ser nombre + inicial del apellido.
- **Hojas a ignorar**: cualquier hoja cuyo encabezado no sea el de la bitácora, por ejemplo «Causa», «Xlat» (oculta, listas de validación), «Horas por Consultor Todos» (tabla dinámica), «Detalle1», «Detalle2», «Hoja1». No dependas de los nombres: **detecta las hojas de consultor por su encabezado**, para que un consultor nuevo entre solo.

Columnas A–N de cada hoja de consultor (el encabezado puede variar levemente):

| Col | Encabezado | Notas |
|---|---|---|
| A | Fecha | fecha de Excel |
| B | Cliente | p. ej. ACH, Davivienda HCM, Davivienda ERP, U. Alberto H, SDS, Fiduprevisora |
| C | Consultor | nombre completo |
| D | Tipo | Mesa Ayuda, Evolutivo, Preventa, Proyecto Implementación, Capacitaciones… |
| E | **Caso** o **No Caso** | **el encabezado cambia según la hoja**: unifícalos |
| F | Título del Caso | texto libre |
| G | Consultor de Apoyo | opcional |
| H | Estado | p. ej. «M - Solucionado», «E - Construcción», «M - Pendiente Cliente»; a veces vacío |
| I | Hora Inicio | hora (fracción de día) |
| J | Hora Fin | hora (fracción de día) |
| K | Tiempo Invertido | fórmula `=(J-I)*24`, horas decimales |
| L | Clasificación Hora | Hora Normal / Hora Adicional / vacío |
| M | Contrato Anterior | opcional |
| N | Actividades Realizadas | texto libre; a veces muy largo (correos completos con saltos de línea) |

Más reglas de lectura:
- Mapea las columnas **por nombre de encabezado** (sin distinguir mayúsculas, tildes ni espacios extra) y no por posición. Ten sinónimos (`Caso`/`No Caso`/`N° Caso`/`Número de caso`).
- Algunas hojas tienen columnas extra a la derecha (p. ej. «HORAS TOTALES» con un factor 1,75 para tiempo extra). **Ignóralas**: la fuente de verdad es «Tiempo Invertido».
- Si «Tiempo Invertido» está vacío o no es numérico, recalcúlalo con Hora Fin − Hora Inicio. Si el resultado es ≤ 0, márcalo como alerta.
- Redondea las horas a 2 decimales para evitar errores de coma flotante (p. ej. 7,999999 → 8).
- Ignora las filas totalmente vacías. Una fila con datos pero sin fecha es una alerta, no se descarta.
- Conserva para cada registro: hoja de origen y número de fila (para poder decir «Hoja Edwin V, fila 214»).
- El campo Caso puede venir como número (3732), texto (`TASK0049890`, `PRB0043331`, `INC1604646`, `DAV-EVO-028`), «SIN CASO», «SinCaso», «IN», 0, vacío o nombres de actividad («Recepcion CAI», «Montaje Laboratorio - Guiones», «Seguimiento ACH», «INVENTARIOS»).

## Reglas de negocio (todas configurables en una pantalla de Configuración)

Guarda la configuración en IndexedDB/localStorage y permite **exportarla e importarla como JSON**.

1. **Normalización del caso**: quitar espacios, pasar los códigos alfanuméricos a mayúsculas y escribir los números sin decimales (`3732.0` → `3732`).
2. **Caso sin número**: vacío, 0, «SIN CASO», «SINCASO», «SIN-CASO», «N/A», «NA», «-» (lista editable).
3. **Caso válido**: coincide con alguno de estos patrones (editables):
   - `^\d+$`
   - `^(TASK|PRB|INC|RITM|REQ|CHG|SCTASK|SP)\d+$`
   - `^[A-Z]{2,6}-[A-Z]{2,6}-\d+$`
   - más una **lista blanca** de nombres aceptados como caso (vacía por defecto; el usuario puede agregar, p. ej., «Seguimiento ACH»).
4. **Caso no reconocido**: tiene valor pero no cumple ninguna regla anterior. Va a revisión, pero sus horas sí cuentan en los totales.
5. **Semana laboral**: lunes a viernes. Los registros de sábado y domingo se muestran aparte y se marcan como alerta. Una opción define si suman en los totales semanales (por defecto **no**, pero aparecen como nota «X h registradas fuera de lun–vie»).
6. **Jornada larga**: umbral configurable, por defecto ≥ 10 h por consultor y día.
7. **Casos relacionados**: si el código de un caso aparece dentro del título de otro (p. ej. el título de PRB0043331 menciona TASK0050017), se muestran como relacionados. Su suma es opcional y nunca es automática.
8. **Formato numérico**: es-CO. Horas en decimales con coma (`7,5 h`) por defecto, con la opción de mostrarlas como `7:30`.
9. **Cliente**: tómalo tal como viene, sin espacios extra. Ofrece en Configuración un mapa de alias opcional (p. ej. «Davivienda HCM» y «Davivienda ERP» se mantienen separados por defecto).

## Pantallas (replicar este diseño)

Diseño general: barra lateral oscura fija a la izquierda (azul marino `#16203A`) con el logo «AMS», «Bitácora AMS · Informes de horas», navegación y, abajo, «Fuente de datos» (nombre del archivo, estado de sincronización y número de hojas de consultor leídas). Contenido sobre un fondo `#F4F5F7` con tarjetas blancas (borde `#DDE1E8`, radio de 12 px). Color de acento `#1F5FBF`; las alertas usan naranja (`#FFF4E5` de fondo y `#7A3E00` de texto) y lo solucionado, verde suave. Tipografía IBM Plex Sans, con IBM Plex Mono para los códigos de caso (incrústalas; si no es viable, usa una fuente del sistema). Debe ser responsiva, accesible (botones reales, etiquetas, contraste AA, objetivos de 44 px) y sin emojis. La navegación lateral muestra un contador naranja con el número de registros a revisar.

Cinco secciones más Configuración:

### 1. Tablero
- Encabezado «Tablero semanal» con «Datos leídos hoy h:mm · N registros en total».
- Controles: selector **Diario | Semanal**, navegación de periodo con flechas («Lun 19 – Vie 23 oct 2026»; en vista diaria, un día), filtros de **Cliente** y **Consultor** (multiselección) y botón «Actualizar».
- Cuatro indicadores: Horas registradas (con «N consultores · lun a vie»), Casos trabajados (con «N registros»), Clientes atendidos (con «X concentra el N %») y **Registros a revisar** (tarjeta naranja que enlaza a la sección 4).
- Gráficas de barras horizontales: **Horas por cliente** y **Horas por tipo de servicio**.
- **Horas por consultor y día**: tabla tipo mapa de calor, con días en columnas y total; las celdas que superan el umbral de jornada larga van resaltadas en naranja.
- **Casos de la semana**: tabla con Caso (enlace al detalle; insignia «Sin caso» cuando aplique), Cliente, Título, Consultor(es), Último estado (píldora), Horas. Ordenable, con filtro por texto y botón «Exportar a Excel» (xlsx con los datos agregados).

### 2. Buscar caso
- Buscador grande. Acepta número o código de caso, o texto del título. Mientras escribes, sugiere coincidencias.
- Busca en **todas las hojas** y suma las horas de todos los consultores que registraron ese caso.
- Ficha del caso: código, cliente, tipo, título, consultor(es), último estado con fecha.
- Indicadores: **horas acumuladas**, registros, periodo (primera – última fecha) y horas de la semana actual.
- Aviso de **caso relacionado** con la casilla «Sumar en el total».
- Gráfica de **horas por semana (lun–vie)** y un aviso si hay horas en fin de semana.
- **Resumen de actividades** agrupado por estado, en orden cronológico: estado, rango de fechas, número de registros, horas y un texto representativo (las actividades únicas, sin duplicados, recortadas).
- Tabla de registros del caso (más recientes primero): fecha, consultor, estado, actividad (expandible si es larga) y horas; indica la hoja de origen.
- Botones «PDF de este caso» y «Exportar registros».

### 3. Informe para cliente
- Formulario: **Cliente**, **Periodo** (semana lun–vie, día o rango personalizado).
- **Casos a incluir**: «Todos los casos del cliente en el periodo (N)» o «Solo los casos que pidió el cliente», con chips donde se pueden pegar varios códigos separados por coma, espacio o salto de línea. Si un código no aparece en el periodo, avisa.
- **Contenido del PDF** (casillas): horas por caso, horas acumuladas desde el inicio (hasta el fin del periodo), resumen de actividades, detalle por día, nombre del consultor y gráfica de horas por día.
- **Verificación previa** (aviso naranja): si el cliente tiene horas sin número de caso en el periodo, dilo («ACH tiene 2,5 h esta semana sin número de caso…») y deja elegir entre **agrupar como «Actividades generales»** o **excluir**. Haz lo mismo con las horas de fin de semana y los registros sin estado.
- **Resumen editable**: por cada caso, la app propone un borrador a partir de las actividades registradas (deduplicadas, sin firmas ni saludos de correo como «Buenas tardes», «Saludos», «Quedo atento», y con un máximo de ~400 caracteres). El usuario lo edita en un área de texto antes de exportar. Esos textos editados se guardan por cliente, caso y periodo.
- **Nota para el cliente** (opcional).
- **Vista previa** del PDF al lado del formulario, que se actualiza al cambiar opciones.
- Botones: **Descargar PDF** y **Generar para todos los clientes** (un PDF por cliente del periodo, empaquetados en .zip).
- Nombre del archivo: `Informe_horas_<Cliente>_<AAAA-MM-DD>_al_<AAAA-MM-DD>.pdf`, sin caracteres inválidos.

### 4. Registros a revisar
- Encabezado con periodo y conteo («10 registros: 7 en días hábiles y 3 en fin de semana») y la casilla «Incluir sábado y domingo».
- Tarjetas por tipo de alerta con su conteo, que funcionan como filtros activables: sin número de caso, sin estado, sin actividades, caso no reconocido, fin de semana, jornadas largas, horas ≤ 0 o hora fin antes de la hora inicio, franjas que se cruzan (mismo consultor y día) y fila sin fecha.
- Tabla: Hoja, Fila, Fecha, Cliente, Caso, Título, Estado («vacío» en cursiva naranja), Horas y «Qué falta» (insignias).
- **«Copiar lista por consultor»**: copia al portapapeles un texto agrupado por consultor, listo para pegar en un correo o en Teams y pedir las correcciones. También exporta a Excel.
- Panel **Reglas de validación** con las reglas activables y el umbral de jornada editable (son las mismas de Configuración).

### 5. Configuración
- Archivo conectado: cambiar o desconectar.
- Reglas de negocio de la sección anterior.
- Datos para el PDF: **logo** (subir PNG o JPG, guardado localmente), nombre de la empresa, texto del pie, tamaño de papel (Carta por defecto, A4 opcional) y si se muestran los nombres de los consultores (por defecto: iniciales y apellido, «C. Trujillo»).
- Exportar e importar la configuración (JSON).

## El PDF para el cliente

Tamaño Carta, márgenes de ~0,6–0,75 in, texto oscuro sobre blanco y legible en escala de grises.

- **Encabezado** en cada página: logo a la izquierda y, a la derecha, «Informe semanal de horas» con «Emitido: <fecha>», sobre una línea inferior azul marino.
- **Título**: «<Cliente> · Horas invertidas por caso» y, debajo, el periodo en texto completo («Lunes 19 – viernes 23 de octubre de 2026»).
- Tres indicadores: horas del periodo, casos atendidos y consultores.
- **Tabla**: Caso (monoespaciada), Descripción, Consultor (si está activado), Estado (último, sin el prefijo «M - »/«E - »), Horas del periodo y Acumulado. La fila de Total va en negrita. Las filas sin caso aparecen como «—» con la descripción «Actividades generales» cuando se eligió agruparlas.
- **Resumen de actividades**: por cada caso, «CÓDIGO · N h» seguido del texto editado.
- Opcionales: detalle por día (tabla de fecha × caso) y gráfica de horas por día.
- La nota para el cliente va al final.
- **Pie** en cada página: «Fuente: bitácora de servicios AMS · horas en decimales» y «Página X de Y».
- Las tablas largas pasan a la página siguiente repitiendo el encabezado de la tabla.

## Arquitectura sugerida

```
src/
  worker/leerBitacora.ts      # SheetJS en Web Worker → registros normalizados
  dominio/
    tipos.ts                  # Registro, Caso, Alerta, Config...
    normalizar.ts             # encabezados, caso, horas, fechas
    reglas.ts                 # validaciones → alertas
    agregaciones.ts           # por día/semana/cliente/consultor/caso/tipo
    periodos.ts               # semanas lun–vie, rangos, formato es-CO
    resumenActividades.ts     # borradores de resumen
    relacionados.ts
  pdf/informeCliente.ts       # definición pdfmake
  almacenamiento/             # IndexedDB: handle, config, logo, resúmenes editados
  ui/ (pantallas y componentes)
tests/
muestras/                     # Excel de muestra (NO se sube a git)
fixtures/                     # Excel sintético generado por script, SÍ se sube
```

## Datos de prueba y verificación

- **No subas a git datos reales de clientes.** Agrega `muestras/` y `*.xlsx` (salvo `fixtures/`) al `.gitignore`.
- Crea un script que genere un **Excel sintético** con la misma estructura e incluya todos los casos difíciles: encabezados «Caso» y «No Caso», casos numéricos y de texto, «SIN CASO» y «SinCaso», vacíos, sin estado, actividades largas con saltos de línea, sábados, franjas cruzadas, horas negativas, hojas auxiliares que se deben ignorar y una columna extra «HORAS TOTALES».
- Pruebas unitarias (Vitest) para normalizar, reglas, agregaciones, periodos y resúmenes.
- **Prueba de aceptación con la copia real** (si te la doy en `muestras/`). En la semana lun 19 – vie 23 oct 2026 deben salir estos valores:
  - Total: **92 h**, 48 registros, 20 casos distintos, 5 clientes.
  - Por cliente: ACH **56,5**, Davivienda ERP **20**, Davivienda HCM **8,5**, U. Alberto H **4**, SDS **3**.
  - Por consultor: Camilo Trujillo **49 h** (10, 10, 10, 9, 10) y Edwin Villamil **43 h** (8,5, 8,5, 9, 8,5, 8,5).
  - Por tipo: Evolutivo 51,5; Mesa Ayuda 28; Preventa 9,5; Proyecto Implementación 3.
  - Caso **TASK0050017**: 39 registros y **116,5 h** en total (18 sep – 27 oct); acumulado al 23 oct, **99,5 h**; esa semana, 21 h.
  - ACH esa semana: TASK0050017 21; PRB0043331 11,5; TASK0050160 7,5; TASK0050186 7,5; TASK0050236 2,5; TASK0050145 2; TASK0050085 1; «Seguimiento ACH» 1; sin caso («SinCaso») 2,5.
  - Alertas lun–vie: 7 registros sin caso (5 «SinCaso» de Edwin sin estado y 2 «SIN CASO» de Camilo); el sábado 24 oct hay 3 registros de Camilo, uno de ellos con el caso vacío.
- Prueba de humo del `dist/BitacoraAMS.html`: que abra desde `file://`, cargue el fixture, muestre el tablero y genere un PDF sin errores en consola y **sin ninguna petición de red**.
- Rendimiento: con un libro sintético de 40 hojas × 3.000 filas, la carga debe tardar menos de ~5 s y la interfaz no debe bloquearse.

## Fases

1. **Base**: proyecto Vite + React + TS, build a HTML único, `CLAUDE.md`, `.gitignore`, script de fixture y lectura del Excel en el worker con normalización y pruebas. Una pantalla mínima que muestre «N hojas de consultor, N registros».
2. **Acceso al archivo**: File System Access, persistencia del handle, reconexión, «Actualizar», respaldos (fallbacks) y manejo de errores.
3. **Tablero** (diario y semanal) con filtros, gráficas, mapa de calor, tabla de casos y exportación a Excel.
4. **Buscar caso** con acumulados, gráfica semanal, resumen por estado, relacionados y registros.
5. **Registros a revisar** con reglas, filtros, «Copiar lista por consultor» y exportación.
6. **Configuración** con reglas, logo, datos del PDF y exportación/importación.
7. **Informe para cliente y PDF**: formulario, verificación previa, resúmenes editables, vista previa, PDF individual, por caso y en lote (.zip).
8. **Pulido y entrega**: accesibilidad, responsividad, rendimiento, prueba de humo, `LEEME.md` con capturas y el HTML final en `dist/`.

## Criterios de terminado

- Abro `BitacoraAMS.html` con doble clic, conecto la bitácora una vez, y en adelante me basta un clic para tener los datos al día.
- Encuentro cualquier caso y veo sus horas totales de todas las hojas en segundos.
- Genero el PDF semanal de un cliente en menos de un minuto, con resúmenes que puedo editar.
- Veo qué registros están incompletos y puedo enviárselos a cada consultor.
- Sin instalar nada, sin red y sin modificar la bitácora.
