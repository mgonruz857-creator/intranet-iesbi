/**
 * Servidor local de guardias para probar la intranet sin Google, con datos FICTICIOS.
 * Lee profesorado y horarios del servidor local de convivencia (servidor central):
 *
 *   SECRETO_INTRANET=prueba npx tsx pruebas/convivencia/servidor-local.mts                 (puerto 8788)
 *   SECRETO_INTRANET=prueba node pruebas/guardias/servidor-local.mjs                        (puerto 8789)
 *   VITE_URL_API_CONVIVENCIA=http://localhost:8788 VITE_URL_API_GUARDIAS=http://localhost:8789 npm run dev
 *
 * Las horas de guardia se cargan subiendo el PDF de Séneca en Panel del centro → Horarios
 * (o con guardarHorarios en el servidor de convivencia).
 */
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { crearEntorno } from '../salidas/simulador.mjs';

const e = crearEntorno({}, {
  codigo: 'guardias',
  // UrlFetchApp es síncrono: se imita con curl contra el servidor local de convivencia
  urlFetch: (url, params) => ({ codigo: 200,
    texto: execFileSync('curl', ['-s', '-X', 'POST', '--data-binary', '@-', url], { input: params.payload }).toString() }),
});
e.props.URL_SERVIDOR_CENTRAL = process.env.URL_SERVIDOR_CENTRAL || 'http://localhost:8788';
if (process.env.SECRETO_INTRANET) e.props.SECRETO_INTRANET = process.env.SECRETO_INTRANET;

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') { res.end(JSON.stringify({ ok: true, servicio: 'Guardias (local)' })); return; }
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => {
    let r;
    try { r = e.pedir(JSON.parse(cuerpo || '{}'), new Date()); } catch (err) { r = { ok: false, codigo: 'ERROR_PETICION', mensaje: String(err) }; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(r));
  });
}).listen(8789, () => console.log('Servidor de guardias (pruebas) en http://localhost:8789'));
