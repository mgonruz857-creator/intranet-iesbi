# Prueba de uso con perfiles ficticios

Simula en un navegador real a siete docentes inventados, con distinta soltura y dispositivo (ver `resto.cjs` y
`carmen.cjs`). Centro ficticio en `centro.mts`. Ningún dato es real.

1. `CENTRO_FICTICIO=1 LATENCIA_MS=1200 SERVIDOR_UNICO=1 npx tsx pruebas/convivencia/servidor-local.mts`
2. `VITE_URL_API_CONVIVENCIA=http://localhost:8788 npx vite --port 3014`
3. `node pruebas/usuarios/carmen.cjs` y después `node pruebas/usuarios/resto.cjs` (o `resto.cjs lucia` para uno solo).

Capturas y diarios en `/tmp/perfiles-capturas` (o `CAPTURAS=...`). Reiniciar el servidor (1) antes de repetir.
Informe del 20/11/2026: Claude Doc «Prueba de uso con perfiles ficticios – Intranet IESBI».
