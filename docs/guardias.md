# Guardias

Módulo de la intranet para ausencias del profesorado y cobertura de guardias. Decisiones de Miguel Ángel (19/11/2026).

## Cómo funciona

- **Ausencia:** el docente elige el día; la app le muestra sus clases de ese día (del horario del panel) con grupo y
  aula. Marca las horas, escribe el motivo y la tarea de cada hora (texto y archivo opcional, máx. 8 MB).
  Jefatura (permiso JEFATURA) puede registrarla por otro docente.
- **Motivo:** dato personal. Solo lo ven el propio docente y quien tiene permiso JEFATURA (Jefatura y Dirección).
- **Reparto automático:** cada hora se asigna al docente de guardia de esa hora (casillas GUARDIA del horario de
  Séneca) que no esté ausente ese día ni tenga otra guardia a esa hora, con menos guardias en el curso (hechas +
  pendientes); empate por orden alfabético del correo. Sin nadie libre: "sin cubrir" (en rojo para Jefatura).
  Si quien cubre registra después una ausencia ese día, sus guardias pendientes se reparten de nuevo.
- **Cambios:** Jefatura puede cambiar quién cubre; un docente de guardia a esa hora puede coger una sin cubrir.
- **Registro:** quien cubre (o Jefatura) la marca como hecha y anota incidencias.
- **Recuento:** guardias por docente desde el 1 de septiembre (empieza de cero cada curso).
- **Guardias de recreo:** solo se ven en el cuadrante del día; no se asignan.
- **Privacidad de la cobertura (20/11/2026):** el docente que registra su ausencia no sabe quién cubre sus horas ni si
  alguna ha quedado sin cubrir (ni al registrarla, ni en "Mis ausencias", ni en el día: ve "Su ausencia"). Solo
  Jefatura/Dirección lo ve. Lo controla el servidor (`registrarAusencia_` y `vistaGuardia_`, marca `propia`).
- **Parte diario (20/11/2026):** Jefatura/Dirección imprime desde "Día" el parte de guardias de la fecha elegida:
  hora, grupo, aula, docente ausente, quién cubre (o SIN CUBRIR), tarea, más el profesorado de
  guardia. Sin motivos. (Se puede guardar en PDF desde el diálogo de imprimir.)
- **Mi horario (20/11/2026):** cada docente ve e imprime su horario semanal (acción `miHorario`; incluye las horas
  prestadas si es sustituto). Jefatura puede ver el de cualquier docente.

## Piezas

- `servidores/guardias/Code.gs`: servidor (Apps Script dentro de una hoja con las pestañas Ausencias y Guardias;
  archivos de tarea en la carpeta Tareas_Guardias junto a la hoja). Solo entra con el acceso único (`entrarConVale`).
  Profesorado, permiso (DOCENTE / JEFATURA) y horarios: `datosCentro` del servidor central (caché de 10 minutos).
  Propiedades: `SECRETO_INTRANET` y `URL_SERVIDOR_CENTRAL`. Funciones de editor: `configurarHoja`,
  `probarServidorCentral`, `limpiarCache`.
- Horarios: el servidor central guarda filas `[email, día, desde, hasta, grupo, aula]`; las horas de guardia llevan
  grupo `GUARDIA` o `GUARDIA_RECREO` (`tipoGuardia` en `src/nucleo/seneca/horarioSeneca.ts`, al subir el PDF en el
  panel). `datosCentro` no las envía a salidas.
- `src/modulos/guardias/`: pantallas Día, Ausencias y Recuento (solo JEFATURA). URL del servidor en
  `config/entorno.ts` (o `VITE_URL_API_GUARDIAS`).
- Pruebas: `pruebas/guardias.test.mts`. Local: `pruebas/guardias/servidor-local.mjs` (puerto 8789).
