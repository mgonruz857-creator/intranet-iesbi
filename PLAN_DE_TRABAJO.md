# Plan de trabajo – Intranet IESBI

convivenciaiesbi.github.io (la app del centro) no se toca en ninguna fase.

## ✅ Fase 1 – Portada + convivencia (PRUEBAS)

- [x] Portada con los tres módulos (salidas y guardias como "Próximamente") y franja para volver.
- [x] Convivencia copiada de ConvivenciaIesbiClaude (b5fb30f) en `src/modulos/convivencia`, contra SIGC_PRUEBAS.
- [x] Entorno único en `src/config/entorno.ts`.
- [x] Pruebas de convivencia adaptadas (`pruebas/convivencia`) y pasando.
- [x] Quitadas dependencias que no se usaban (express, @google/genai, dotenv, motion) y `dist/` fuera del repositorio.
- [ ] Probar en la web de pruebas con usuarios de pruebas.

Mientras convivencia siga cambiando en ConvivenciaIesbiClaude, hay que traer esos cambios aquí.
Propuesta: a partir de ahora, los cambios nuevos de convivencia se hacen en la intranet.

## ✅ Fase 2 – Salidas al baño (PRUEBAS)

- [x] Copiada de `salidas-bano-iesbi` (e9be6b7): `src/modulos/salidas`, `servidores/salidas/Code.gs`, `pruebas/salidas`.
- [x] Usa el mismo servidor de PRUEBAS que ya tenía (hoja con alumnado ficticio). PRODUCCION sigue sin URL.
- [x] Pruebas pasando (15) y probada en el navegador con el simulador.
- [ ] Probar en la web de pruebas.

Igual que con convivencia: los cambios nuevos de salidas, mejor hacerlos ya en la intranet.

## Fase 3 – Acceso único

- [x] Un solo inicio de sesión en la portada (el de convivencia); salidas entra sola con un vale firmado.
- [x] Servidores: `valeIntranet` + `crearSecretoIntranet` (convivencia) y `entrarConVale` (salidas, v1.1.0).
- [x] Pruebas: `pruebas/acceso_unico.test.mts` y prueba completa en el navegador con servidores simulados.
- [x] Servidores de PRUEBAS pegados y clave copiada (19/11/2026). Funciona: salidas entra sin contraseña.
- Pendiente para producción: lo mismo con los servidores del centro, cuando se decida pasar la intranet.

## Fase 4 – Guardias

- [x] Ausencias, cuadrante de guardias (horario de Séneca), reparto automático, registro y recuento (19/11/2026,
      ver `docs/guardias.md`). Motivo solo para JEFATURA; recuento desde el 1 de septiembre.
- [ ] Miguel Ángel: pegar el servidor central nuevo, crear el servidor de guardias de pruebas (hoja en
      proyectoIntranet/PRUEBAS) y pasar su URL para ponerla en `src/modulos/guardias/config/entorno.ts`.
- [ ] Volver a subir el PDF de horarios de Séneca en el panel (para guardar las horas de guardia y las aulas).

## Pendiente (cuando proceda) – Panel de control unificado

Petición de Miguel Ángel (28/10/2026): profesorado y alumnado se usan en varios módulos y hoy están duplicados.
Hay que reestructurarlo en un panel de control común antes de que crezcan los módulos.

Duplicidades actuales:
- **Profesorado**: en el JSON de convivencia (`profesores`, con rol y tutoría) y en la pestaña `Profesorado` de la
  hoja de salidas (con `rol` DOCENTE/DIRECTIVO y aula). Un alta o una baja hay que hacerla dos veces.
- **Alumnado**: en el JSON de convivencia (`alumnos`, importado de Séneca) y en la pestaña `Alumnado` de salidas.
  Mismos identificadores y códigos de grupo, pero copias distintas.
- **Horarios**: solo en salidas (pestaña `Horario`, leída del PDF de Séneca). Guardias también los necesitará.
- **Roles y permisos**: cada módulo tiene los suyos (ROLE_CONVIVENCIA_ADMIN… / DIRECTIVO).
- **Contraseñas**: con el acceso único sobran las propias de salidas (y no debería tenerlas guardias).

Propuesta (19/11/2026, pendiente de aprobar): https://claude.ai/artifact/Cchzun6RSMWfnudF3VLqXr

Decisiones de Miguel Ángel (19/11/2026):
- Los datos viven en el servidor de convivencia, que pasa a llamarse **servidor central de la intranet**
  (en pruebas, el proyecto `API_SIGC_PRUEBAS` se puede renombrar `API_Intranet_PRUEBAS`; producción no se toca).
- Gestionan el panel los administradores de convivencia y, después, Jefatura, Dirección y Miguel Ángel.
  Los administradores del panel se pueden añadir y quitar desde el propio panel (siempre queda al menos uno).
- El lector del PDF de horarios de Séneca pasa al panel.
- Bajas: se conserva el histórico y se ocultan de las listas.
- Salidas y guardias nunca reciben teléfonos ni datos de familias.
- Cambio de curso: **a la vez desde el panel**. Los datos del centro (alumnado, grupos, horarios) cambian una sola vez
  y cada módulo archiva su histórico en ese momento; convivencia mantiene visibles los expedientes abiertos.
  (Se construye al final.)

Pasos:
- [x] Paso 1: servidor central (pruebas): `horarios` y `permisos_intranet` (solo cambian con sus acciones),
      acciones `perfilIntranet`, `panelLeer`, `guardarPermisos`, `guardarHorarios` y `datosCentro` (firmada,
      para otros servidores). Pruebas en `pruebas/datos_centro.test.mts`.
- [x] Paso 2: Panel del centro en la intranet: profesorado y permisos (salidas, guardias, administradores del panel)
      y horarios desde el PDF de Séneca. Alumnado: de momento sigue en Convivencia (enlace desde el panel).
- [x] Pegar el servidor central de pruebas en Apps Script y probar el panel (Miguel Ángel, 19/11).
- [x] Altas/bajas de profesorado y alumnado desde el panel (19/11, aprobado por Miguel Ángel): pestañas Profesorado,
      Alumnado (con importación de Séneca y fusión de repetidos) y Copias de seguridad. Mismos datos y guardado que
      convivencia; en Convivencia queda un aviso con enlace y solo los cursos escolares. Requiere ser administrador de
      Convivencia (un administrador del panel que no lo sea ve un aviso). Restaurar desde archivo sigue en la ventana
      de mantenimiento de Drive de Convivencia.
- [x] Paso 3: salidas lee del servidor central (servidor de salidas 1.2.0). Con la propiedad `URL_SERVIDOR_CENTRAL`
      toma profesorado, alumnado, horarios y permiso DIRECTIVO de `datosCentro` (caché de 10 minutos); sus pestañas
      Profesorado, Alumnado y Horario dejan de usarse. Pruebas en `pruebas/salidas_central.test.mts`.
- [x] Pegar el servidor de salidas 1.2.0 en PRUEBAS, añadir `URL_SERVIDOR_CENTRAL` y ejecutar `probarServidorCentral`
      (Miguel Ángel, 19/11: funciona).

Drive (19/11/2026): todo lo de la intranet va en la carpeta `proyectoIntranet` del Drive de Miguel Ángel
(`proyectoIntranet/PRUEBAS/`: API_Intranet_PRUEBAS, hoja de salidas, SIGC_PRUEBAS y lo nuevo, como guardias;
más adelante `proyectoIntranet/PRODUCCION/`). Siempre en Mi unidad, mismo propietario. La convivencia en uso no se mueve.
- [x] Paso 4: guardias (pendiente de configurar en Apps Script).
- [ ] Al final: cambio de curso desde el panel.

Resumen de la propuesta:
- Una única fuente de "datos del centro" (profesorado, alumnado, grupos, horarios, curso escolar) con un panel
  para Jefatura/Dirección: altas, bajas, importación de Séneca (alumnado ODS y PDF de horarios) y roles por módulo.
- Los módulos leen de ella en lugar de tener su copia. Opciones: que la sirva el servidor de convivencia
  (ya tiene profesorado y alumnado) o un servidor "núcleo" nuevo; decidir pensando en el tamaño del JSON de convivencia.
- Permisos por módulo en un solo sitio (p. ej. profesor → {convivencia: ADMIN, salidas: DIRECTIVO, guardias: …}).

Cuestiones a plantear antes de empezar:
- ¿Quién mantiene los datos del centro (Jefatura, Dirección, secretaría)?
- ¿Qué pasa con un alumno dado de baja que tiene partes o salidas registradas? (conservar histórico).
- Cambio de curso escolar: ¿se archivan los datos de cada módulo a la vez?
- Migración: cómo pasar los datos actuales de convivencia y salidas sin parar la app del centro.
- RGPD: cada módulo debería recibir solo los datos que necesita (salidas no necesita teléfonos, por ejemplo).

## Paso al centro

- [ ] Transferir el repositorio a la organización `intranetiesbi`, renombrarlo `intranetiesbi.github.io`
      y publicar con PRODUCCION, cuando Miguel Ángel lo diga.
- [ ] Al pasar a producción (acordado el 19/11/2026, NO antes): quitar el botón "Vaciar alumnos y partes" y el
      recuadro "Infraestructura Google Drive & ETL de Ingesta" (`EtlImportView`); en Copias de seguridad dejar solo
      el botón "Descargar copia completa".
