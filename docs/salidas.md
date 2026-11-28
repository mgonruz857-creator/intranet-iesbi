# Módulo de salidas al baño (GBCS)

Copiado de `mgonruz857-creator/salidas-bano-iesbi` (commit e9be6b7, 24/10/2026) a `src/modulos/salidas/`,
con su servidor en `servidores/salidas/Code.gs` y sus pruebas en `pruebas/salidas/`. Notas de su CLAUDE.md, con las rutas adaptadas.
El paso a paso para montar la hoja y el servidor está en `docs/salidas-despliegue.md`.

## Qué es

App web para autorizar y registrar las salidas al baño (PRD v3.1.0 de Miguel Ángel), pensada para integrarse
después en la app de convivencia: mismo estilo (React + TypeScript + Vite + Tailwind v4 + lucide-react, GitHub
Pages), mismo tipo de servidor (Apps Script por POST con `accion`), mismo acceso (correo + contraseña con sal
en las propiedades del script, sesión de 6 h) y mismos códigos de grupo e identificadores de alumno.

- `servidores/salidas/Code.gs`: servidor. Va dentro de la hoja de cálculo (pestañas Profesorado, Alumnado,
  Historico_Salidas, Horario). Se pega tal cual en Apps Script.
- `src/`: la app. `src/modulos/salidas/config/entorno.ts (el entorno se elige en src/config/entorno.ts)` elige PRUEBAS / PRODUCCION y la URL del servidor.
- `src/nucleo/seneca/horarioSeneca.ts`: lee el PDF "Horarios de profesores" de Séneca (en el navegador, con pdf.js).

## Acceso único (intranet)

- Dentro de la intranet, el módulo entra con un vale firmado por el servidor de convivencia (acción `entrarConVale`),
  si el script tiene la propiedad `SECRETO_INTRANET` (la misma clave que convivencia). El docente tiene que estar
  en la pestaña Profesorado; si no, ve un aviso. Con ese acceso no se muestra "Cambiar contraseña" y salir de
  aquí cierra la sesión de toda la intranet.
- Sin la propiedad (o con el servidor antiguo), se pide la contraseña propia del módulo, como antes.

## Datos del centro (servidor central, desde la versión 1.2.0)

- Si el script tiene la propiedad `URL_SERVIDOR_CENTRAL` (dirección /exec del servidor de convivencia), el
  profesorado, el alumnado y los horarios se piden a su acción `datosCentro` (firmada con `SECRETO_INTRANET`) y se
  guardan 10 minutos en caché. Las pestañas Profesorado, Alumnado y Horario dejan de usarse; solo queda
  Historico_Salidas.
- Correspondencias: docente → nombre "Apellidos, Nombre", aula = su tutoría, `directivo` = permiso DIRECTIVO en el
  panel. Alumno → `id_alumno`, grupo. Nunca llegan teléfonos ni datos de familias.
- En ese modo el horario y las contraseñas propias no se gestionan aquí (`HORARIO_EN_PANEL`); la pantalla de
  Profesorado enlaza al Panel del centro. Si el servidor central no responde, error `ERROR_CENTRAL` (no se vuelve
  en silencio a las pestañas).
- `probarServidorCentral` (desde el editor) comprueba la conexión y pide el permiso de Google para conectarse a
  servicios externos la primera vez.
- Local: `URL_SERVIDOR_CENTRAL=http://localhost:8788` en `pruebas/salidas/servidor-local.mjs`.

## Reglas (normas del centro, versión 1.4.0, 27/11/2026)

- Lunes a viernes. Tramo 1 08:30–11:30, recreo 11:30–12:00 sin salidas, tramo 2 12:00–15:00.
- **1ª y 4ª hora: no se sale**, salvo excepción que autoriza el propio profesor: en la ventana marca "Autorizo esta
  salida como excepción" y escribe el motivo (el servidor exige `excepcion_hora: true` y motivo; si no,
  `ERROR_HORA_NO_PERMITIDA`). En el histórico queda "Excepción autorizada por el profesor (1ª hora): motivo".
- **3ª y 5ª hora: recomendadas** (autorización directa). 2ª y 6ª: con motivo de ≥ 5 caracteres.
- **Dos edificios** (`edificioDe_` en el servidor, `edificioDe` en la app): A = cursos pares de ESO y Bachillerato
  (2º, 4º ESO, 2º Bach) y 1º de FP Básica; B = el resto (1º y 3º ESO, 1º Bach, ciclos y 2º de FP Básica; confirmado
  por Miguel Ángel el 28/11/2026). **Máximo 2 fuera a la vez en cada edificio**
  (`CUPO_EDIFICIO`, error `ERROR_EDIFICIO_LLENO`) y ≤ 1 por grupo, con `LockService`. La pantalla muestra el
  contador de cada edificio.
- 1 salida por alumno y tramo (antes y después del recreo); la 2ª es excepcional con justificación de ≥ 10
  caracteres (la autoriza el profesor) y avisa de quién autorizó la anterior y a qué hora.
- Temporizador de 5 minutos. Cualquier docente puede marcar el regreso; quien autorizó puede anular en 2 min.
- Al terminar un tramo, las salidas sin regreso se cierran como `NO_RETURN` (decisión propuesta por Claude).
- Equipo Directivo (`rol` = DIRECTIVO): histórico, profesorado, restablecer contraseñas e importar horarios.

## Pruebas

- `npm run test:salidas`: servidor (simulador de Apps Script en `pruebas/salidas/simulador.mjs`) y lector de horarios, con datos ficticios.
- `npm run build`: tipos y compilación.
- Probar la app sin Google: `SIM_DESDE="2026-10-23 09:40" node pruebas/salidas/servidor-local.mjs` y
  `VITE_URL_API_SALIDAS=http://localhost:8787 npm run dev`.
