/**
 * Servidor local de convivencia para probar la intranet sin Google, con datos FICTICIOS.
 *
 *   SECRETO_INTRANET=prueba npx tsx pruebas/convivencia/servidor-local.mts      (puerto 8788)
 *   SECRETO_INTRANET=prueba node pruebas/salidas/servidor-local.mjs              (puerto 8787)
 *   VITE_URL_API_CONVIVENCIA=http://localhost:8788 VITE_URL_API_SALIDAS=http://localhost:8787 npm run dev
 *
 * Servidor único (salidas y guardias dentro): SERVIDOR_UNICO=1 npx tsx pruebas/convivencia/servidor-local.mts
 * y basta con VITE_URL_API_CONVIVENCIA=http://localhost:8788 npm run dev.
 *
 * Centro ficticio completo (6 grupos, 60 alumnos, 8 docentes, horarios y una sustitución) y respuestas con la
 * lentitud de Google: CENTRO_FICTICIO=1 LATENCIA_MS=1500 SERVIDOR_UNICO=1 npx tsx pruebas/convivencia/servidor-local.mts
 * (cuentas en pruebas/usuarios/centro.mts; contraseña del administrador: Infante2026).
 *
 * Cuentas: mgonruz857@g.educaand.es (administrador), docente.uno@g.educaand.es y directiva@g.educaand.es
 * (primer acceso: cualquier contraseña válida).
 */
import http from 'node:http';
const { crearServidor } = await import('./simulador.mts');
const { generarServidorAppsScript } = await import('../../src/modulos/convivencia/services/appsScriptServidor.ts');

const profesor = (id: string, email: string, nombre: string, rol = 'ROLE_DOCENTE') =>
  ({ id_profesor: id, email, nombre, apellidos: 'Ejemplo', rol, estado: 'ACTIVO' });
const centro = process.env.CENTRO_FICTICIO ? await import('../usuarios/centro.mts') : null;
const DATOS = centro ? centro.DATOS : {
  profesores: [
    profesor('p1', 'mgonruz857@g.educaand.es', 'Administrador', 'ROLE_CONVIVENCIA_ADMIN'),
    profesor('p2', 'docente.uno@g.educaand.es', 'Docente Uno'),
    profesor('p3', 'directiva@g.educaand.es', 'Directiva'),
  ],
  alumnos: [{ id_alumno: 'al-1', nombre: 'Ana', apellidos: 'FICTICIA', grupo: '1ESO_A' }],
  sanciones: [], compensaciones: [], audit_logs: [],
};
let srv: any;
if (process.env.SERVIDOR_UNICO) {
  const { crearServidorUnico } = await import('../unico/entorno.mts');
  srv = crearServidorUnico(DATOS).srv;
  srv.props.set('ID_HOJA_SALIDAS', 'hoja-salidas');
  srv.props.set('ID_HOJA_GUARDIAS', 'hoja-guardias');
} else {
  srv = crearServidor(generarServidorAppsScript(), DATOS);
}
if (process.env.SECRETO_INTRANET) srv.props.set('SECRETO_INTRANET', process.env.SECRETO_INTRANET);
if (centro) { if (process.env.SERVIDOR_UNICO) { srv.ctx.guardiasConfigurarHoja(); srv.ctx.salidasConfigurarHoja(); } centro.prepararCentro(srv); }
const LATENCIA = Number(process.env.LATENCIA_MS || 0);

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.end(JSON.stringify({ ok: true, servicio: 'SIGC-BI (local)' })); return; }
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => {
    let r;
    try { r = srv.post(JSON.parse(cuerpo || '{}')); } catch (err) { r = { ok: false, error: String(err) }; }
    setTimeout(() => res.end(JSON.stringify(r)), LATENCIA);
  });
}).listen(8788, () => console.log('Servidor de convivencia (pruebas) en http://localhost:8788'));
