import crypto from 'crypto';
// Servidor central: permisos por módulo, horarios y lectura firmada para otros módulos (datos ficticios).
const { crearServidor } = await import('./convivencia/simulador.mts');
const { generarServidorAppsScript } = await import('../src/modulos/convivencia/services/appsScriptServidor.ts');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra ? ' → ' + extra : ''}`); };

const ADMIN = 'mgonruz857@g.educaand.es', DOC = 'docente.uno@g.educaand.es', JEFA = 'jefatura.prueba@g.educaand.es';
const prof = (id: string, email: string, rol = 'ROLE_DOCENTE', extra = {}) =>
  ({ id_profesor: id, email, nombre: 'N' + id, apellidos: 'A' + id, rol, estado: 'ACTIVO', ...extra });
const srv = crearServidor(generarServidorAppsScript(), {
  profesores: [prof('p1', ADMIN, 'ROLE_CONVIVENCIA_ADMIN'), prof('p2', DOC, 'ROLE_DOCENTE', { tutor_de_grupo: '1ESO_A' }), prof('p3', JEFA),
    prof('p4', 'baja.prueba@g.educaand.es', 'ROLE_DOCENTE', { estado: 'INACTIVO' })],
  alumnos: [{ id_alumno: 'al-1', nombre: 'Ana', apellidos: 'FICTICIA', grupo: '1ESO_A', estado: 'ACTIVO', telefono_tutor: '600111222', nombre_tutor: 'Madre' },
    { id_alumno: 'al-2', nombre: 'Baja', apellidos: 'FICTICIA', grupo: '1ESO_A', estado: 'BAJA', telefono_tutor: '', nombre_tutor: '' }],
  sanciones: [], compensaciones: [], audit_logs: [],
});
const entrar = (email: string) => srv.post({ accion: 'login', email, clave: 'clave2026' }).token;
const tAdmin = entrar(ADMIN), tDoc = entrar(DOC), tJefa = entrar(JEFA);

console.log('== Permisos');
let r = srv.post({ accion: 'perfilIntranet', token: tAdmin });
ok('el administrador de convivencia es administrador del panel por defecto', r.ok && r.permisos.panel === true && r.permisos.convivencia === 'ADMIN');
r = srv.post({ accion: 'perfilIntranet', token: tDoc });
ok('un docente no lo es, y en salidas/guardias es DOCENTE', r.ok && r.permisos.panel === false && r.permisos.salidas === 'DOCENTE' && r.permisos.guardias === 'DOCENTE');
r = srv.post({ accion: 'panelLeer', token: tDoc });
ok('un docente no puede leer el panel', !r.ok && r.codigo === 'PROHIBIDO');
r = srv.post({ accion: 'guardarPermisos', token: tDoc, email: DOC, permisos: { panel: true } });
ok('ni darse permisos a sí mismo', !r.ok && r.codigo === 'PROHIBIDO');
r = srv.post({ accion: 'guardarPermisos', token: tAdmin, email: JEFA, permisos: { panel: true, salidas: 'DIRECTIVO', guardias: 'JEFATURA' } });
ok('el administrador da permisos a Jefatura', r.ok && r.permisos.panel && r.permisos.salidas === 'DIRECTIVO' && r.permisos.guardias === 'JEFATURA');
r = srv.post({ accion: 'panelLeer', token: tJefa });
ok('Jefatura ya puede usar el panel', r.ok && r.profesores.length === 4);
r = srv.post({ accion: 'guardarPermisos', token: tAdmin, email: DOC, permisos: { salidas: 'REY' } });
ok('un permiso inventado se rechaza', !r.ok && r.codigo === 'PERMISO');
r = srv.post({ accion: 'guardarPermisos', token: tJefa, email: ADMIN, permisos: { panel: false } });
ok('se puede quitar un administrador si queda otro', r.ok && r.permisos.panel === false);
r = srv.post({ accion: 'guardarPermisos', token: tJefa, email: JEFA, permisos: { panel: false } });
ok('no se puede quitar el último administrador', !r.ok && r.codigo === 'ULTIMO_ADMIN');
r = srv.post({ accion: 'guardarPermisos', token: tJefa, email: ADMIN, permisos: { panel: true } });

console.log('== Horarios');
r = srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [
  [DOC, 1, '08:30', '09:30', '1ESO_A'], [DOC, 5, '9:30', '10:30', '3ESO_C'],
  ['nadie@g.educaand.es', 1, '08:30', '09:30', '1ESO_A'], [DOC, 6, '08:30', '09:30', '1ESO_A'], [DOC, 2, '10:00', '09:00', '1ESO_A']] });
ok('guarda solo las filas válidas', r.ok && r.guardados === 2, JSON.stringify(r));
r = srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [[JEFA, 3, '12:00', '13:00', '2BACH_B']] });
ok('el horario de otro docente se añade sin borrar el anterior', r.ok && r.total === 3);
r = srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [[DOC, 2, '08:30', '09:30', '1ESO_B']] });
ok('volver a subir el de un docente sustituye solo el suyo', r.ok && r.total === 2);
r = srv.post({ accion: 'guardarHorarios', token: tDoc, filas: [] });
ok('un docente no puede guardar horarios', !r.ok && r.codigo === 'PROHIBIDO');

console.log('== "guardar" de convivencia no pisa horarios ni permisos');
const leido = srv.post({ accion: 'leer', token: tAdmin }).data;
const viejo = JSON.parse(JSON.stringify(leido));
viejo.horarios = []; viejo.permisos_intranet = {};
r = srv.post({ accion: 'guardar', token: tAdmin, data: viejo });
const db = JSON.parse(srv.archivos['DB']);
ok('un guardado con datos antiguos no borra los horarios', r.ok && db.horarios.length === 2);
ok('...ni los permisos', db.permisos_intranet?.[JEFA]?.panel === true);

console.log('== Lectura firmada para otros módulos');
const peticion = (modulo: string, secreto: string, exp = Date.now() + 60000) => {
  const datos = JSON.stringify({ modulo, exp, n: 'x' });
  return { datos, firma: crypto.createHmac('sha256', secreto).update(datos).digest('base64') };
};
r = srv.post({ accion: 'datosCentro', peticion: peticion('salidas', 'k') });
ok('sin clave secreta no da datos', !r.ok && r.codigo === 'SIN_ACCESO_UNICO');
srv.ctx.crearSecretoIntranet();
const secreto = srv.props.get('SECRETO_INTRANET')!;
r = srv.post({ accion: 'datosCentro', peticion: peticion('salidas', 'otra') });
ok('con otra clave no da datos', !r.ok && r.codigo === 'NO_AUTH');
r = srv.post({ accion: 'datosCentro', peticion: peticion('salidas', secreto, Date.now() - 1000) });
ok('una petición caducada no da datos', !r.ok && r.codigo === 'NO_AUTH');
r = srv.post({ accion: 'datosCentro', peticion: peticion('salidas', secreto) });
ok('con la clave da los datos', r.ok);
ok('profesorado activo con su permiso en salidas', r.profesores.length === 3 && r.profesores.find((p: any) => p.email === JEFA).permiso === 'DIRECTIVO'
  && r.profesores.find((p: any) => p.email === DOC).tutor_de_grupo === '1ESO_A');
ok('alumnado activo, sin teléfonos ni familias', r.alumnos.length === 1 && !JSON.stringify(r).includes('600111222') && !JSON.stringify(r).includes('Madre'));
ok('y los horarios', r.horarios.length === 2);
ok('sin contraseñas ni datos internos', !/credenciales|password|CLAVE_/.test(JSON.stringify(r)));
r = srv.post({ accion: 'datosCentro', peticion: peticion('guardias', secreto) });
ok('para guardias, el permiso de guardias', r.ok && r.profesores.find((p: any) => p.email === JEFA).permiso === 'JEFATURA');

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
