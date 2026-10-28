/**
 * Servidor local de convivencia para probar la intranet sin Google, con datos FICTICIOS.
 *
 *   SECRETO_INTRANET=prueba npx tsx pruebas/convivencia/servidor-local.mts      (puerto 8788)
 *   SECRETO_INTRANET=prueba node pruebas/salidas/servidor-local.mjs              (puerto 8787)
 *   VITE_URL_API_CONVIVENCIA=http://localhost:8788 VITE_URL_API_SALIDAS=http://localhost:8787 npm run dev
 *
 * Cuentas: mgonruz857@g.educaand.es (administrador), docente.uno@g.educaand.es y directiva@g.educaand.es
 * (primer acceso: cualquier contraseña válida).
 */
import http from 'node:http';
const { crearServidor } = await import('./simulador.mts');
const { generarServidorAppsScript } = await import('../../src/modulos/convivencia/services/appsScriptServidor.ts');

const profesor = (id: string, email: string, nombre: string, rol = 'ROLE_DOCENTE') =>
  ({ id_profesor: id, email, nombre, apellidos: 'Ejemplo', rol, estado: 'ACTIVO' });
const srv = crearServidor(generarServidorAppsScript(), {
  profesores: [
    profesor('p1', 'mgonruz857@g.educaand.es', 'Administrador', 'ROLE_CONVIVENCIA_ADMIN'),
    profesor('p2', 'docente.uno@g.educaand.es', 'Docente Uno'),
    profesor('p3', 'directiva@g.educaand.es', 'Directiva'),
  ],
  alumnos: [{ id_alumno: 'al-1', nombre: 'Ana', apellidos: 'FICTICIA', grupo: '1ESO_A' }],
  sanciones: [], compensaciones: [], audit_logs: [],
});
if (process.env.SECRETO_INTRANET) srv.props.set('SECRETO_INTRANET', process.env.SECRETO_INTRANET);

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.end(JSON.stringify({ ok: true, servicio: 'SIGC-BI (local)' })); return; }
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => {
    let r;
    try { r = srv.post(JSON.parse(cuerpo || '{}')); } catch (err) { r = { ok: false, error: String(err) }; }
    res.end(JSON.stringify(r));
  });
}).listen(8788, () => console.log('Servidor de convivencia (pruebas) en http://localhost:8788'));
