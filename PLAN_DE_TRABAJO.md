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
- [ ] Pegar los dos servidores de PRUEBAS en Apps Script, crear la clave y copiarla (Miguel Ángel).
- [ ] Probar en la web de pruebas.
- Pendiente para producción: lo mismo con los servidores del centro, cuando se decida pasar la intranet.

## Fase 4 – Guardias

- [ ] Ausencias, cuadrante de guardias (horario de Séneca), propuesta de cobertura, histórico.

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

Propuesta a decidir:
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
