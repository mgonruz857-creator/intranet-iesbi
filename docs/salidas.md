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
- `src/modulos/salidas/services/horarioSeneca.ts`: lee el PDF "Horarios de profesores" de Séneca (en el navegador, con pdf.js).

## Acceso único (intranet)

- Dentro de la intranet, el módulo entra con un vale firmado por el servidor de convivencia (acción `entrarConVale`),
  si el script tiene la propiedad `SECRETO_INTRANET` (la misma clave que convivencia). El docente tiene que estar
  en la pestaña Profesorado; si no, ve un aviso. Con ese acceso no se muestra "Cambiar contraseña" y salir de
  aquí cierra la sesión de toda la intranet.
- Sin la propiedad (o con el servidor antiguo), se pide la contraseña propia del módulo, como antes.

## Reglas (PRD)

- Lunes a viernes. Bloque 1 08:30–11:30 (preferente A 09:30–10:30), recreo 11:30–12:00 sin salidas,
  bloque 2 12:00–15:00 (preferente B 13:00–14:00). Fuera de la hora preferente, motivo de ≥ 5 caracteres.
- Cupo: ≤ 5 fuera en todo el centro y ≤ 1 por grupo, con `LockService`.
- 1 salida por alumno y bloque; la 2ª es excepcional con justificación de ≥ 10 caracteres y avisa de quién
  autorizó la anterior y a qué hora.
- Temporizador de 5 minutos. Cualquier docente puede marcar el regreso; quien autorizó puede anular en 2 min.
- Al terminar un bloque, las salidas sin regreso se cierran como `NO_RETURN` (decisión propuesta por Claude).
- Equipo Directivo (`rol` = DIRECTIVO): histórico, profesorado, restablecer contraseñas e importar horarios.

## Pruebas

- `npm run test:salidas`: servidor (simulador de Apps Script en `pruebas/salidas/simulador.mjs`) y lector de horarios, con datos ficticios.
- `npm run build`: tipos y compilación.
- Probar la app sin Google: `SIM_DESDE="2026-10-23 09:40" node pruebas/salidas/servidor-local.mjs` y
  `VITE_URL_API_SALIDAS=http://localhost:8787 npm run dev`.
