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

console.log('== Equivalencias de grupos de Séneca (del centro, no del navegador)');
r = srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [], docentes: [],
  equivalencias: { '1º ESO A': '1ESO_A', 'Reunión dpto.': '', 'Raro': 'no-vale<script>' } });
let eqs = srv.post({ accion: 'panelLeer', token: tAdmin }).equivalencias;
ok('se guardan y las lee el panel', eqs['1º ESO A'] === '1ESO_A' && eqs['Reunión dpto.'] === '' && !('Raro' in eqs), JSON.stringify(eqs));
r = srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [], docentes: [], equivalencias: { 'Reunión dpto.': '2ESO_A' } });
eqs = srv.post({ accion: 'panelLeer', token: tAdmin }).equivalencias;
ok('una nueva elección cambia solo esa y conserva las demás', eqs['Reunión dpto.'] === '2ESO_A' && eqs['1º ESO A'] === '1ESO_A');
{
  const d = srv.post({ accion: 'leer', token: tAdmin }).data;
  d.equivalencias_grupos = { '1º ESO A': '' };
  srv.post({ accion: 'guardar', token: tAdmin, data: d });
  ok('"guardar" de convivencia no las cambia', srv.post({ accion: 'panelLeer', token: tAdmin }).equivalencias['1º ESO A'] === '1ESO_A');
}

console.log('== Nombre de Séneca → docente (se recuerda en el servidor)');
r = srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [[DOC, 4, '08:30', '09:30', '1ESO_A']], docentes: [DOC],
  correspondencias: { 'PÉREZ  RARO,DANI': DOC, 'NADIE,NADA': 'nadie@g.educaand.es' } });
let co = srv.post({ accion: 'panelLeer', token: tAdmin }).correspondencias;
ok('se recuerda el nombre asignado a mano (y no uno que no está de alta)', co['PÉREZ RARO,DANI'] === DOC && !('NADIE,NADA' in co), JSON.stringify(co));
r = srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [], docentes: [], pendientes: [{ nombre: 'OTRO,NOMBRE', filas: [[1, '08:30', '09:30', '1ESO_A', '']] }] });
r = srv.post({ accion: 'resolverHorarioPendiente', token: tAdmin, nombreSeneca: 'OTRO,NOMBRE', email: JEFA });
co = srv.post({ accion: 'panelLeer', token: tAdmin }).correspondencias;
ok('asignar un horario pendiente también lo recuerda', r.ok && co['OTRO,NOMBRE'] === JEFA, JSON.stringify(r));

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

console.log('== Horarios de Séneca sin docente');
r = srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [], docentes: [],
  pendientes: [{ nombre: 'NUEVO FICTICIO,PEPE', filas: [[2, '08:30', '09:30', '1ESO_A', 'A12'], [2, '09:30', '10:30', 'GUARDIA', ''], [9, '08:30', '09:30', '1ESO_A', '']] },
    { nombre: 'OTRO FICTICIO,LUIS', filas: [[3, '08:30', '09:30', '2ESO_B', '']] }] });
ok('las páginas sin docente quedan pendientes (con filas válidas)', r.ok && r.pendientes === 2);
r = srv.post({ accion: 'panelLeer', token: tAdmin });
ok('el panel las ve', r.ok && r.pendientes.length === 2 && r.pendientes[0].filas.length === 2, JSON.stringify(r.pendientes));
r = srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [], docentes: [], resueltos: ['OTRO FICTICIO,LUIS'] });
ok('si en otra subida ese nombre ya tiene docente, deja de estar pendiente', r.ok && r.pendientes === 1);
r = srv.post({ accion: 'resolverHorarioPendiente', token: tDoc, nombreSeneca: 'NUEVO FICTICIO,PEPE', email: 'pepe.ficticio@g.educaand.es', nombre: 'Pepe', apellidos: 'Nuevo Ficticio' });
ok('un docente sin panel no puede resolverlos', !r.ok && r.codigo === 'PROHIBIDO');
r = srv.post({ accion: 'resolverHorarioPendiente', token: tJefa, nombreSeneca: 'NUEVO FICTICIO,PEPE', email: 'pepe.ficticio@g.educaand.es', nombre: 'Pepe', apellidos: 'Nuevo Ficticio' });
ok('dar de alta exige ser administrador de Convivencia', !r.ok && r.codigo === 'PROHIBIDO');
r = srv.post({ accion: 'resolverHorarioPendiente', token: tAdmin, nombreSeneca: 'NUEVO FICTICIO,PEPE', email: 'pepe@gmail.com', nombre: 'Pepe', apellidos: 'Nuevo' });
ok('el correo tiene que ser del dominio', !r.ok && r.codigo === 'EMAIL');
r = srv.post({ accion: 'resolverHorarioPendiente', token: tAdmin, nombreSeneca: 'NUEVO FICTICIO,PEPE', email: 'Pepe.Ficticio@g.educaand.es', nombre: 'Pepe', apellidos: 'Nuevo Ficticio' });
ok('el administrador da de alta al docente con su horario', r.ok && r.alta === true && r.horas === 2);
r = srv.post({ accion: 'panelLeer', token: tAdmin });
const pepe = r.profesores.find((p: any) => p.email === 'pepe.ficticio@g.educaand.es');
ok('...queda activo, con su horario, y sin pendientes', !!pepe && pepe.estado === 'ACTIVO' && r.pendientes.length === 0
  && r.horarios.filter((f: any) => f[0] === 'pepe.ficticio@g.educaand.es').length === 2);
ok('...y puede entrar (primer acceso)', srv.post({ accion: 'estadoCuenta', email: 'pepe.ficticio@g.educaand.es' }).registrado === true);
srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [], docentes: [], pendientes: [{ nombre: 'TERCERO,ANA', filas: [[1, '12:00', '13:00', '3ESO_C', '']] }] });
r = srv.post({ accion: 'resolverHorarioPendiente', token: tJefa, nombreSeneca: 'TERCERO,ANA', email: DOC });
ok('asignar a un docente existente no exige ser administrador de Convivencia', r.ok && r.alta === false);
srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [], docentes: [], pendientes: [{ nombre: 'CUARTO,LUIS', filas: [[1, '12:00', '13:00', '3ESO_C', '']] }] });
r = srv.post({ accion: 'resolverHorarioPendiente', token: tJefa, nombreSeneca: 'CUARTO,LUIS', accion2: 'descartar' });
ok('se puede descartar', r.ok && srv.post({ accion: 'panelLeer', token: tAdmin }).pendientes.length === 0);
const leido2 = srv.post({ accion: 'leer', token: tAdmin }).data;
leido2.horarios_pendientes = [{ nombre: 'X', filas: [] }];
srv.post({ accion: 'guardar', token: tAdmin, data: leido2 });
ok('"guardar" de convivencia no toca los pendientes', srv.post({ accion: 'panelLeer', token: tAdmin }).pendientes.length === 0);

console.log('== Sustituciones');
const SUS1 = 'sustituta.uno@g.educaand.es', SUS2 = 'sustituto.dos@g.educaand.es';
const sus = (datos: any, token = tAdmin) => srv.post({ accion: 'gestionarSustitucion', token, ...datos });
srv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [[DOC, 1, '08:30', '09:30', '1ESO_A', 'A12'], [DOC, 2, '10:30', '11:30', 'GUARDIA', '']], docentes: [DOC] });
r = sus({ operacion: 'iniciar', titular: DOC, email: SUS1, nombre: 'Sara', apellidos: 'Sustituta' }, tDoc);
ok('solo el panel registra sustituciones', !r.ok && r.codigo === 'PROHIBIDO');
r = sus({ operacion: 'iniciar', titular: DOC, email: SUS1, nombre: 'Sara', apellidos: 'Sustituta' });
ok('se inicia con un sustituto nuevo (alta)', r.ok && r.sustitucion.sustituto === SUS1 && r.sustitucion.tutoria === '1ESO_A');
const idSus = r.sustitucion.id;
r = srv.post({ accion: 'login', email: DOC, clave: 'clave2026' });
ok('el titular ya no puede entrar', !r.ok && r.codigo === 'BAJA');
ok('...y su sesión abierta deja de valer', srv.post({ accion: 'perfilIntranet', token: tDoc }).codigo === 'NO_AUTH');
ok('...estadoCuenta lo da como no activo', srv.post({ accion: 'estadoCuenta', email: DOC }).activo === false);
let panel = srv.post({ accion: 'panelLeer', token: tAdmin });
ok('la tutoría pasa al sustituto', panel.profesores.find((p: any) => p.email === SUS1).tutor_de_grupo === '1ESO_A'
  && !panel.profesores.find((p: any) => p.email === DOC).tutor_de_grupo);
r = srv.post({ accion: 'datosCentro', peticion: peticion('guardias', secreto) });
ok('los módulos no ven al titular', !r.profesores.some((p: any) => p.email === DOC));
ok('el horario del titular lo usa el sustituto (guardias incluidas)', r.horarios.filter((f: any) => f[0] === SUS1).length === 2
  && !r.horarios.some((f: any) => f[0] === DOC));
ok('el horario guardado sigue siendo del titular (se presta, no se copia)', panel.horarios.filter((f: any) => f[0] === DOC).length === 2);
r = sus({ operacion: 'iniciar', titular: DOC, email: SUS2, nombre: 'X', apellidos: 'Y' });
ok('no puede haber dos sustituciones del mismo titular', !r.ok);
r = sus({ operacion: 'cambiar', id: idSus, email: SUS2, nombre: 'Samuel', apellidos: 'Sustituto Dos', bajaAnterior: true });
ok('si el sustituto se va, se asigna otro', r.ok && r.sustitucion.sustituto === SUS2 && r.sustitucion.anteriores[0].sustituto === SUS1);
panel = srv.post({ accion: 'panelLeer', token: tAdmin });
ok('...el anterior queda de baja y la tutoría pasa al nuevo', panel.profesores.find((p: any) => p.email === SUS1).estado === 'INACTIVO'
  && panel.profesores.find((p: any) => p.email === SUS2).tutor_de_grupo === '1ESO_A');
r = srv.post({ accion: 'datosCentro', peticion: peticion('salidas', secreto) });
ok('...y el nuevo usa el horario (sin guardias para salidas)', r.horarios.filter((f: any) => f[0] === SUS2).length === 1);
r = sus({ operacion: 'finalizar', id: idSus, bajaSustituto: true });
ok('al volver el titular se finaliza', r.ok && r.sustitucion.estado === 'FINALIZADA');
panel = srv.post({ accion: 'panelLeer', token: tAdmin });
ok('el titular recupera la tutoría y el sustituto queda de baja', panel.profesores.find((p: any) => p.email === DOC).tutor_de_grupo === '1ESO_A'
  && panel.profesores.find((p: any) => p.email === SUS2).estado === 'INACTIVO');
ok('el titular vuelve a entrar', srv.post({ accion: 'login', email: DOC, clave: 'clave2026' }).ok === true);
r = srv.post({ accion: 'datosCentro', peticion: peticion('guardias', secreto) });
ok('y vuelve a tener su horario en los módulos', r.horarios.filter((f: any) => f[0] === DOC).length === 2);

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
