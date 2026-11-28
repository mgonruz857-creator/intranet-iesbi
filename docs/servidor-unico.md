# Servidor único de la intranet

Decisión de Miguel Ángel (20/11/2026): un solo proyecto de Apps Script para toda la intranet, para que entrar en
cada módulo sea más rápido.

## Cómo es

- El proyecto del servidor central (en pruebas, `API_Intranet_PRUEBAS`) lleva tres archivos de código:
  - `Intranet.gs`: el servidor central de siempre (convivencia, panel, sesión de toda la intranet). Se genera con
    `generarServidorAppsScript` (`src/modulos/convivencia/services/appsScriptServidor.ts`).
  - `Salidas.gs` y `Guardias.gs`: los módulos, generados desde `servidores/salidas/Code.gs` y
    `servidores/guardias/Code.gs` (no se editan a mano). Cada uno va encerrado en su propio espacio
    (`MODULO_SALIDAS`, `MODULO_GUARDIAS`) para que sus funciones no choquen con las del central.
- Generarlos: `npx tsx servidores/unico/generar.mts <carpeta>`.
- Cada módulo sigue con **su hoja de cálculo** (no se mueve ningún dato). El servidor la abre con la propiedad
  `ID_HOJA_SALIDAS` / `ID_HOJA_GUARDIAS` (el identificador está en la dirección de la hoja, entre `/d/` y `/edit`).
- La app habla a los módulos en el servidor central con `{ modulo, accion, token }`. El token es la sesión de la
  intranet: no hay vales ni contraseñas propias. El servidor comprueba la sesión (`sesionModulo`) y el módulo
  comprueba que el docente sigue en su profesorado activo (datos del centro leídos directamente con
  `datosCentroInterno`, sin pasar por la red).
- Cada guardado del servidor central borra la copia de datos del centro de los módulos (`limpiarCachesModulos`):
  bajas, permisos y horarios se notan al momento.
- Entrar en un módulo: una llamada (`entrarUnico`) en lugar de vale + entrada + consulta entre servidores.

## Compatibilidad y vuelta atrás

- La app prueba primero el servidor único. Si el servidor central no lleva el módulo (versión antigua o módulo
  sin instalar), usa el servidor propio del módulo con el vale, como antes. Por eso el cambio de la app se puede
  publicar antes de instalar el servidor único, y volver atrás no exige tocar la app.
- **Si algo falla:** en el proyecto de Apps Script, Implementar → Gestionar implementaciones → lápiz →
  Versión: la anterior → Implementar. La dirección no cambia. Los datos están en las hojas y en Drive: volver a
  una versión anterior del código no los toca. La app vuelve sola a los servidores propios de cada módulo.
- Los servidores propios de salidas y guardias (y las propiedades `SECRETO_INTRANET`, `URL_SERVIDOR_CENTRAL`) se
  mantienen como respaldo mientras se prueba. Se retirarán al pasar a producción.

## Instalación (la hace Miguel Ángel en el proyecto del servidor central)

1. Sustituir el código del archivo que ya hay por `Intranet.gs`.
2. Añadir dos archivos de secuencia de comandos, `Salidas` y `Guardias`, con `Salidas.gs` y `Guardias.gs`.
3. Propiedades del script: `ID_HOJA_SALIDAS` e `ID_HOJA_GUARDIAS`.
4. Ejecutar `salidasConfigurarHoja` y `guardiasConfigurarHoja` (piden el permiso de Google para abrir las hojas;
   solo añaden pestañas que falten, nunca borran).
5. Implementar → Gestionar implementaciones → lápiz → Nueva versión → Implementar.

## Pruebas

- `pruebas/servidor_unico.test.mts`: los tres archivos juntos (sin nombres repetidos, sesión única, guardias y
  salidas dentro, cambios al momento, errores aislados, sin red, cierre de sesión).
- Servidor local: `SERVIDOR_UNICO=1 npx tsx pruebas/convivencia/servidor-local.mts` y
  `VITE_URL_API_CONVIVENCIA=http://localhost:8788 npm run dev`.

## Reloj de pruebas (salidas 1.5.0 y guardias 1.5.0, 28/11/2026)

Solo en PRUEBAS: en Salidas y en Guardias aparece arriba la barra "Reloj de pruebas" (`src/nucleo/RelojPruebas.tsx`)
para simular un día y una hora (con botones de 1ª a 6ª hora y recreo) y volver a la hora real. Acción `relojPruebas`
de cada módulo (`{ fijar: 'AAAA-MM-DD HH:mm' }` o `{ quitar: true }`); guarda la propiedad `RELOJ_PRUEBAS` del proyecto,
común a los dos módulos, y el reloj sigue avanzando desde ahí. Solo funciona si Intranet.gs es de PRUEBAS
(`ES_PRUEBAS`); en PRODUCCIÓN la acción no existe y `RELOJ_PRUEBAS` se ignora. Prueba: `pruebas/reloj_pruebas.test.mts`.
El reloj de convivencia y del panel no cambia.
