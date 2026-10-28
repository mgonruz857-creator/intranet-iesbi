# Módulo de convivencia (SIGC-BI)

Copiado de `mgonruz857-creator/ConvivenciaIesbiClaude` (commit b5fb30f, 21/10/2026) a `src/modulos/convivencia/`.
Las notas siguientes vienen de su CLAUDE.md, con las rutas adaptadas a la intranet.

Importante: el servidor de PRODUCCIÓN (`API_Convivencia_BlasInfante`, implementación `…HimLNQ`) es el que usa
la app del centro convivenciaiesbi.github.io. Desde la intranet no se genera ni se cambia hasta que Miguel Ángel
lo diga expresamente.

## Servidor (Google Apps Script)

- El código del servidor se genera desde `src/modulos/convivencia/services/appsScriptServidor.ts` (plantilla `String.raw`:
  **sin comillas invertidas ni `${` dentro**). Generarlo con:
  `npx tsx -e "import('./src/modulos/convivencia/services/appsScriptServidor.ts').then(m=>require('fs').writeFileSync('/home/claude/Servidor_PRUEBAS_v2.gs', m.generarServidorAppsScript()))"`
  (con `ENTORNO = 'PRODUCCION'` en `src/config/entorno.ts` sale el de producción; en esta intranet NO se genera el de producción hasta que Miguel Ángel lo diga). Enviárselo como archivo.
- PRUEBAS: proyecto `API_SIGC_PRUEBAS` en la cuenta de Miguel Ángel (mgonruz857), carpeta SIGC_PRUEBAS.
- PRODUCCIÓN: proyecto `API_Convivencia_BlasInfante` en la cuenta del centro; implementación de siempre
  (termina en `…HimLNQ`), se actualiza con "Gestionar implementaciones → lápiz → Nueva versión" (misma URL).
  Volver atrás = elegir la versión anterior.
- Si el cambio añade o cambia acciones del servidor que usa la app → hace falta **nueva versión de la
  implementación**. Si solo afecta a tareas programadas o funciones de editor → basta con pegar y guardar.
- Si se añaden permisos nuevos (correo, tareas…), Google los pide al ejecutar una función desde el editor:
  avisar de que **marque todas las casillas**.
- Funciones de editor existentes: `crearSecretoIntranet` (acceso único de la intranet; ver CLAUDE.md), `restablecerClaveAdministrador`, `diagnosticoDatos`,
  `activarResumenDiario`, `probarResumenTutores`, `enviarResumenTutores`, `desactivarResumenDiario`,
  `revisarVersionesDatos` (solo lee las versiones de Drive), `restaurarUltimaVersionValida` (si el archivo está vacío o dañado),
  `activarCopiasDiarias`, `copiaSeguridadDiaria`, `listarCopiasDiarias`, `restaurarCopiaDiaria` (con `FECHA_COPIA_A_RESTAURAR`), `desactivarCopiasDiarias`
  (y las de recuperación ya usadas: `prepararPartesParaRevisar`, `buscarTextosEnVersiones`, `aplicarTextosRecuperados`).

## Emergencias con los datos (qué hacer)

Antes de tocar nada, **no restaurar ni borrar sin que Miguel Ángel lo decida** (norma 3). Pedirle capturas.

- **La app dice "No se puede leer el archivo de datos de Drive"** (el servidor se detiene sin escribir; pasó el
  21/10/2026, Drive dejó el archivo con 0 bytes en un guardado que tardó 35 s):
  1. En Drive (cuenta del centro), vista de lista de la carpeta: ¿cuántos archivos con el nombre del archivo de
     datos?, tamaño, fecha. Un duplicado con el mismo nombre también provoca el error (se arregla renombrándolo).
  2. Si está vacío o dañado: ejecutar `revisarVersionesDatos` (solo lee) y revisar con él la versión buena más
     reciente (fecha, nº de partes/alumnos/profesores).
  3. Con su visto bueno: `restaurarUltimaVersionValida` (guarda `COPIA_RESTAURACION_…json`) y comprobar la app.
  4. Ejecuciones: buscar el `doPost` anormalmente largo a esa hora. Si tardó más de 30 s, la app no recibió la
     confirmación y el cambio quedó pendiente en ese dispositivo (se reenvía solo).
- **Hay que volver a un día anterior** (p. ej. borrados por error descubiertos tarde): copias diarias en
  `COPIAS_SEGURIDAD`; `listarCopiasDiarias`, poner la fecha en `FECHA_COPIA_A_RESTAURAR`, guardar,
  `restaurarCopiaDiaria` (guarda antes `COPIA_ANTES_DE_RESTAURAR_…`), y volver a dejar la línea vacía.
  Avisar de que se deshace lo registrado después de esa fecha.
- **Olvido de la contraseña del administrador**: `restablecerClaveAdministrador`.
- Protección activa: tras cada guardado el servidor comprueba que el archivo no ha quedado vacío
  (`comprobarEscritura`); si lo está, reescribe; si sigue, devuelve `ESCRITURA_FALLIDA` y la app conserva el cambio.

## Pruebas

- Servidor y app con Drive simulado: `pruebas/convivencia/*.test.mts` → `npx tsx pruebas/convivencia/<nombre>.test.mts` (todas: `npm run test:convivencia`).
  Ejecutar todas antes de entregar un cambio del servidor. 
- Tipos y compilación: `npx tsc --noEmit -p .` y `npm run build`.

## Reglas de la app que hay que respetar

- Carnet de puntos: empieza en 10; los partes restan; las medidas restaurativas suman (máx. 10);
  +1 punto cada 7 días naturales desde el ÚLTIMO parte que restó puntos (los de 0 puntos y las medidas no reinician).
- El profesorado sin privilegios solo recibe lo imprescindible (el servidor filtra; `vistaDocente`).
  Los tutores ven completo lo de su grupo. Un docente puede asignarse una tutoría libre en su perfil.
- El PDF de un expediente de sanción solo se genera con los 4 trámites marcados.
- Primer acceso de un docente: escribe su contraseña dos veces (riesgo aceptado por Miguel Ángel).
- Resumen por correo a tutores: lunes a viernes 8:30, solo con partes nuevos, sin datos del alumnado.

## Documentos

- Manuales (Claude Docs): "Manual del profesorado – SIGC-BI" y "Manual del Equipo de Convivencia – SIGC-BI".
  Actualizarlos cuando un cambio afecte a lo que explican (preguntar antes si no está claro).
