// Paso de la app de convivencia antigua a la intranet (28/11/2026): servidores/migracion/ExportarParaIntranet.gs
// en el proyecto antiguo e importarDesdeConvivencia en el servidor de la intranet. Datos ficticios.
import fs from 'fs';
import vm from 'vm';
import crypto from 'crypto';
const { crearServidor } = await import('./simulador.mts');
const { generarServidorAppsScript } = await import('../../src/modulos/convivencia/services/appsScriptServidor.ts');

let fallos = 0;
const ok = (t: string, c: boolean, x = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${x ? ' → ' + x : ''}`); };
const v1 = (t: string) => crypto.createHash('sha256').update(Buffer.from(Array.from(t).map(c => c.charCodeAt(0) & 255))).digest('hex');

const A = 'docente.a@g.educaand.es', B = 'docente.b@g.educaand.es', C = 'docente.c@g.educaand.es', D = 'docente.d@g.educaand.es';
const db: any = {
  version: '3.0.0-PROD',
  profesores: [A, B, C, D].map((email, i) => ({ id_profesor: 'prof-0' + (i + 2), email, nombre: 'N' + i, apellidos: 'Ficticio', rol: 'ROLE_DOCENTE', estado: 'ACTIVO' })),
  credenciales_profesores: { [C]: v1('ceee333') },
  alumnos: [{ id_alumno: 'al-1', nombre: 'Lucía', apellidos: 'Ficticia', grupo: '1ESO_A', puntos_actuales: 8, estado: 'ACTIVO' }],
  sanciones: [{ id_sancion: 's-1', id_alumno: 'al-1', id_profesor: 'prof-02', puntos_restados: 2, fecha: '2026-10-01', descripcion_hechos: 'ficticio' }],
  compensaciones: [{ id: 'c-1' }], audit_logs: [], deleted_sanciones: [], deleted_alumnos: [], deleted_profesores: [],
};

// 1) La app antigua (servidor v2 con contraseñas en sus propiedades)
const viejo = crearServidor(generarServidorAppsScript(), db);
ok('antigua: A fija su contraseña', viejo.post({ accion: 'login', email: A, clave: 'aaaa111' }).ok);
ok('antigua: B fija su contraseña', viejo.post({ accion: 'login', email: B, clave: 'bbbb222' }).ok);
const original = viejo.archivos['DB'];
const propsViejas = new Map(viejo.props);

// 2) intranetExportar en el proyecto antiguo (dos carpetas: origen y PRODUCCION)
const ORIGEN = '1S5zjeSgcfVkL-eoQLsJ9I_ltHAnRrbaS', DESTINO = '1sEI0H7cAwRViVDwtGuQfVdaqsqFPSUcv';
const carpetas: Record<string, Record<string, string>> = { [ORIGEN]: { '00_SIGC_BD_CENTRO_BLAS_INFANTE.json': original }, [DESTINO]: {} };
const fichero = (c: string, n: string) => ({
  getBlob: () => ({ getDataAsString: () => carpetas[c][n], getBytes: () => Array.from(Buffer.from(carpetas[c][n], 'utf8')) }),
  makeCopy: (nuevo: string, dest: any) => { carpetas[dest.id][nuevo] = carpetas[c][n]; },
});
const carpeta = (id: string) => ({ id,
  getFilesByName: (n: string) => { const l = carpetas[id][n] !== undefined ? [fichero(id, n)] : []; let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
  createFile: (n: string, t: string) => { carpetas[id][n] = t; } });
const logs: string[] = [];
const ctxViejo: any = { JSON, Object, Logger: { log: (m: any) => logs.push(String(m)) }, MimeType: { PLAIN_TEXT: 't' },
  DriveApp: { getFolderById: carpeta }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => Object.fromEntries(propsViejas) }) },
  Utilities: viejo.ctx.Utilities };
vm.createContext(ctxViejo);
vm.runInContext(fs.readFileSync(new URL('../../servidores/migracion/ExportarParaIntranet.gs', import.meta.url), 'utf8'), ctxViejo);
ctxViejo.intranetExportar();
ok('exportar: copia idéntica en PRODUCCION', carpetas[DESTINO]['00_SIGC_BD_INTRANET.json'] === original);
ok('exportar: el original no cambia', carpetas[ORIGEN]['00_SIGC_BD_CENTRO_BLAS_INFANTE.json'] === original);
ok('exportar: el registro no muestra contraseñas ni la clave', !logs.join('\n').includes(propsViejas.get('SECRETO_SERVIDOR')!) && !logs.join('\n').includes('"hash"'));
ctxViejo.intranetExportar();
ok('exportar dos veces no sobrescribe la copia', logs.some(l => l.startsWith('PARADO: ya hay')));

// 3) importarDesdeConvivencia en la intranet
const nuevo = crearServidor(generarServidorAppsScript());
nuevo.archivos['DB'] = carpetas[DESTINO]['00_SIGC_BD_INTRANET.json'];
nuevo.archivos['MIGRACION_DESDE_CONVIVENCIA.json'] = carpetas[DESTINO]['MIGRACION_DESDE_CONVIVENCIA.json'];
nuevo.ctx.importarDesdeConvivencia();
const reg = (nuevo.drive.logs || []).join('\n');
ok('importar: confirma copia idéntica', reg.includes('IDÉNTICA'), reg);
ok('importar: recuentos iguales (partes, alumnado, profesorado, compensaciones)', /ok {2}sanciones: original 1/.test(reg) && /ok {2}alumnos: original 1/.test(reg) && /ok {2}profesores: original 4/.test(reg) && /ok {2}compensaciones: original 1/.test(reg));
ok('importar: el archivo de paso va a la papelera', nuevo.archivos['MIGRACION_DESDE_CONVIVENCIA.json'] === undefined);
ok('importar: el archivo de datos no se toca', nuevo.archivos['DB'] === original);
ok('A entra con su contraseña de siempre', nuevo.post({ accion: 'login', email: A, clave: 'aaaa111' }).ok);
ok('B entra con su contraseña de siempre', nuevo.post({ accion: 'login', email: B, clave: 'bbbb222' }).ok);
ok('A con una contraseña equivocada no entra', !nuevo.post({ accion: 'login', email: A, clave: 'otra999' }).ok);
ok('C (contraseña de la versión 1 dentro del archivo) entra con la suya', nuevo.post({ accion: 'login', email: C, clave: 'ceee333' }).ok);
ok('D (sin contraseña) queda como primer acceso', nuevo.post({ accion: 'estadoCuenta', email: D }).tieneClave === false);

// 4) Copia distinta del original: no se pasan contraseñas
const otro = crearServidor(generarServidorAppsScript());
otro.archivos['DB'] = JSON.stringify({ ...db, sanciones: [] });
otro.archivos['MIGRACION_DESDE_CONVIVENCIA.json'] = carpetas[DESTINO]['MIGRACION_DESDE_CONVIVENCIA.json'];
otro.ctx.importarDesdeConvivencia();
ok('copia distinta: se para y avisa', (otro.drive.logs || []).some((l: string) => l.startsWith('PARADO')) && !otro.props.has('CLAVE_' + A));

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
