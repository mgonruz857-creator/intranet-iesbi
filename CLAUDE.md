# Instrucciones para Claude – Intranet IES Blas Infante

Leer esto entero antes de empezar, y también `PLAN_DE_TRABAJO.md` (actualizarlo al terminar cada cambio).

## Con quién trabajas

- **Miguel Ángel González**, profesor e ingeniero informático del centro. Usa Linux.
- **Responder SIEMPRE en español.** Lenguaje claro, sin jerga ni nombres internos de herramientas.
- Cuando solo pregunta ("¿se podría…?", "¿cómo lo ves?"), **responder y proponer, sin tocar nada**.

## Lo que NUNCA se toca

La intranet copia código de las apps existentes, pero **no escribe en ellas**:

- `convivenciaiesbi/convivenciaiesbi.github.io` → **es la app de convivencia que está funcionando en el centro.**
  Ni su repositorio, ni su servidor de Apps Script (`API_Convivencia_BlasInfante`), ni sus datos de Drive.
- `mgonruz857-creator/ConvivenciaIesbiClaude` (copia de pruebas de convivencia) y
  `mgonruz857-creator/salidas-bano-iesbi` (salidas al baño): solo lectura, para copiar código.

## Normas que no se negocian

1. **Todo se prueba primero en PRUEBAS.** Esta copia trabaja siempre con `ENTORNO = 'PRUEBAS'`
   (`src/config/entorno.ts`). Se pasa al centro solo cuando Miguel Ángel lo diga.
2. **Nunca datos reales en pruebas ni en el repositorio.** Un archivo real que aporte se usa solo para lo pedido,
   no se publica y se borra al terminar.
3. **No recuperar ni restaurar datos sin preguntarle antes.**
4. **No tener ni pedir la contraseña de la cuenta del centro** (14007180.aplicaciones@g.educaand.es). Los pasos en
   Apps Script con esa cuenta los hace él, con instrucciones paso a paso.

## Repositorios y direcciones

- Desarrollo (aquí se trabaja): `mgonruz857-creator/intranet-iesbi`, rama `main` = PRUEBAS
  → https://mgonruz857-creator.github.io/intranet-iesbi/
- Destino final: se transferirá a la organización `intranetiesbi` y se renombrará `intranetiesbi.github.io`
  → https://intranetiesbi.github.io/ (cuando esté terminada y Miguel Ángel lo diga).
- Cada push a `main` publica con GitHub Actions (Pages).

## Cómo está hecha

- React 19 + TypeScript + Vite + Tailwind v4 + lucide-react. Navegación con `#/<módulo>`.
- `src/nucleo/`: portada, franja superior de la intranet, lista de módulos (`modulos.ts`) y navegación (`ruta.ts`).
- `src/config/entorno.ts`: único sitio donde se elige PRUEBAS / PRODUCCION para toda la intranet.
- `src/modulos/<módulo>/`: cada módulo, cargado solo al entrar. Cada uno conserva su propio servidor de
  Apps Script, sus datos y (de momento) su propio inicio de sesión. Sus direcciones de servidor están en
  `src/modulos/<módulo>/config/entorno.ts`.
- **Acceso único** (`src/nucleo/accesoUnico.ts`, `src/nucleo/sesion.ts`): el inicio de sesión de la intranet es el de
  convivencia (su servidor identifica al profesorado). Para entrar en otro módulo, el servidor de convivencia firma un
  vale de un solo uso (acción `valeIntranet`, 2 minutos) con la clave `SECRETO_INTRANET` de sus propiedades; el
  servidor del módulo lo comprueba con la misma clave (acción `entrarConVale`) y abre su propia sesión. La clave se
  crea con la función de editor `crearSecretoIntranet` (convivencia) y se copia a mano en las propiedades del script
  de los demás servidores. Si un servidor aún no lo tiene, el módulo pide su propia contraseña como antes.
  Al cerrar la sesión de convivencia se cierran también las de los demás módulos.
- Módulos: `convivencia` (notas en `docs/convivencia.md`), `salidas` (notas en `docs/salidas.md`, servidor en
  `servidores/salidas/Code.gs`) y `guardias` (pendiente).

## Pruebas

- `npm run build`: tipos y compilación.
- `npm run test:convivencia`: servidor y app de convivencia con Drive simulado y datos ficticios.
- `npm run test:salidas`: servidor de salidas (simulador) y lector de horarios de Séneca.
- `npx tsx pruebas/acceso_unico.test.mts`: vales entre el servidor de convivencia y el de salidas.
- `npm test`: todas las anteriores.
- Probar la intranet entera sin Google (servidores simulados): ver la cabecera de `pruebas/convivencia/servidor-local.mts`.
- `npm run test:seguridad`: auditoría de convivencia. En PRUEBAS fallan SEC-11 y SEC-13, igual que en
  ConvivenciaIesbiClaude (comprueban la cuenta del centro y el cierre de sesión en el navegador).
