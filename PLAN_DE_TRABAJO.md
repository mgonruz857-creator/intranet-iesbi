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

- [ ] Un solo inicio de sesión: el servidor de convivencia identifica y emite un vale firmado que aceptan
      los demás servidores. Requiere nueva versión del servidor: primero en PRUEBAS.

## Fase 4 – Guardias

- [ ] Ausencias, cuadrante de guardias (horario de Séneca), propuesta de cobertura, histórico.

## Paso al centro

- [ ] Transferir el repositorio a la organización `intranetiesbi`, renombrarlo `intranetiesbi.github.io`
      y publicar con PRODUCCION, cuando Miguel Ángel lo diga.
