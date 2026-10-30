# Bitácora AMS

App web local (un solo `BitacoraAMS.html`, sin servidor ni red) que LEE la bitácora de horas de consultores (Excel en OneDrive) y genera tableros, búsqueda de casos, alertas de calidad de datos e informes PDF para clientes. Especificación completa: `PROMPT_Bitacora_AMS.md`.

## Reglas de trabajo
- Todo texto de interfaz, mensajes, comentarios para el usuario y documentación: **español (Colombia)**.
- Desarrollo por fases (ver el prompt). Al cerrar cada fase: pruebas, commit en español, resumen y esperar visto bueno.
- Si el prompt choca con el Excel real, preguntar.
- Nunca escribir en la bitácora. Cero llamadas de red en ejecución (sin CDN, fuentes remotas ni telemetría).
- No subir datos reales: `muestras/` y `*.xlsx` (salvo `fixtures/`) están en `.gitignore`.

## Stack
Vite + React + TypeScript estricto · `vite-plugin-singlefile` (salida `dist/index.html`, renombrar a `BitacoraAMS.html` en la entrega) · SheetJS desde `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` · Vitest. Pendientes por fase: pdfmake, JSZip, Recharts, Playwright.

Comandos: `npm test` · `npm run build` · `npm run fixture` (regenera `fixtures/bitacora-sintetica.xlsx`).

## Decisiones técnicas
- El Worker se importa con `?worker&inline` (queda dentro del HTML; un worker en archivo aparte no carga desde `file://`).
- SheetJS se lee **sin `cellDates`**: fechas como seriales numéricos (evita desfase de zona horaria), horas como fracción de día.
- Hojas de consultor: se detectan por encabezado (primera celda `Fecha` + columnas Cliente y Caso), no por nombre. Columnas por nombre normalizado (sin tildes/mayúsculas), con sinónimos (`Caso`/`No Caso`/…).
- Columnas extra a la derecha (p. ej. «HORAS TOTALES») se ignoran. Fuente de verdad: «Tiempo Invertido»; si falta, Hora Fin − Hora Inicio. Horas a 2 decimales.
- Filas sin datos en las columnas mapeadas (aunque tengan `0` en columnas extra) se descartan; filas con datos pero sin fecha se conservan (alerta).
- Cada Registro conserva `hoja` y `fila` de origen.
- Normalización de caso: se recortan espacios (incluso al final: `TASK0050017 `), códigos alfanuméricos en mayúsculas, números sin decimales.

## Estructura
```
src/dominio/   tipos, normalizar, leerLibro (puro, testeable en Node)
src/worker/    leerBitacora.ts (envuelve leerLibro)
src/ui/        pantallas y componentes
tests/         Vitest (la prueba de aceptación solo corre si existe muestras/Bitácora Servicios AMS.xlsx)
fixtures/      Excel sintético (sí se sube a git)
scripts/       generarFixture.mjs
```

## Valores de aceptación (copia real, semana lun 19 – vie 23 oct 2026)
92 h · 48 registros · 20 casos · 5 clientes (ACH 56,5; Davivienda ERP 20; Davivienda HCM 8,5; U. Alberto H 4; SDS 3) · Camilo 49 h, Edwin 43 h.

**Decisión confirmada:** el prompt dice TASK0050017 = 39 registros / 116,5 h (18 sep – 27 oct, acumulado al 23 oct 99,5 h). Eso sale con comparación exacta; 4 filas de Edwin V (39, 41, 43, 44, de agosto) traen `TASK0050017 ` con espacio final. La usuaria confirmó que **son el mismo caso**: con la normalización (recortar espacios) son **43 registros / 134,5 h, 24 ago – 27 oct, acumulado al 23 oct 117,5 h**. Las pruebas usan esos valores. El resto de cifras de la semana 19–23 oct coincide con el prompt.
