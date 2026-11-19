// Salidas lee profesorado, alumnado y horarios del servidor central (convivencia). Datos ficticios.
const { crearServidor } = await import('./convivencia/simulador.mts');
const { generarServidorAppsScript } = await import('../src/modulos/convivencia/services/appsScriptServidor.ts');
// @ts-ignore simulador en JavaScript
const { crearEntorno, madrid } = await import('./salidas/simulador.mjs');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra ? ' → ' + extra : ''}`); };

const ADMIN = 'mgonruz857@g.educaand.es', DOC = 'docente.uno@g.educaand.es', JEFA = 'jefatura.prueba@g.educaand.es';
const BAJA = 'baja.prueba@g.educaand.es';
const prof = (id: string, email: string, rol = 'ROLE_DOCENTE', extra = {}) =>
  ({ id_profesor: id, email, nombre: 'N' + id, apellidos: 'A' + id, rol, estado: 'ACTIVO', ...extra });
const conv = crearServidor(generarServidorAppsScript(), {
  profesores: [prof('p1', ADMIN, 'ROLE_CONVIVENCIA_ADMIN'), prof('p2', DOC, 'ROLE_DOCENTE', { tutor_de_grupo: '1ESO_A' }), prof('p3', JEFA),
    prof('p4', BAJA, 'ROLE_DOCENTE', { estado: 'INACTIVO' })],
  alumnos: [
    { id_alumno: 'al-1', nombre: 'Ana', apellidos: 'FICTICIA', grupo: '1ESO_A', estado: 'ACTIVO', telefono_tutor: '600111222', nombre_tutor: 'Madre' },
    { id_alumno: 'al-2', nombre: 'Luis', apellidos: 'INVENTADO', grupo: '3ESO_C', estado: 'ACTIVO', telefono_tutor: '600333444', nombre_tutor: 'Padre' },
    { id_alumno: 'al-3', nombre: 'Baja', apellidos: 'FICTICIA', grupo: '1ESO_A', estado: 'BAJA', telefono_tutor: '', nombre_tutor: '' }],
  sanciones: [], compensaciones: [], audit_logs: [],
});
conv.ctx.crearSecretoIntranet();
const secreto = conv.props.get('SECRETO_INTRANET')!;
const tAdmin = conv.post({ accion: 'login', email: ADMIN, clave: 'clave2026' }).token;
conv.post({ accion: 'guardarPermisos', token: tAdmin, email: JEFA, permisos: { salidas: 'DIRECTIVO' } });
conv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [[DOC, 5, '09:30', '10:30', '3ESO_C']] });

const URL_CENTRAL = 'https://script.google.com/macros/s/central-ficticio/exec';
let caido = false;
const sal = crearEntorno({
  // Pestañas antiguas con otra gente: en modo central no deben usarse
  Profesorado: [['teacher_id', 'email', 'full_name', 'assigned_classroom_id', 'rol'],
    ['usr_9', 'solo.hoja@g.educaand.es', 'Hoja, Solo', '2ESO_A', 'DIRECTIVO']],
  Alumnado: [['student_id', 'first_name', 'last_name', 'classroom_id', 'is_active'], ['alu_hoja', 'Hoja', 'X', '2ESO_A', true]],
  Historico_Salidas: [['exit_id', 'date', 'student_id', 'classroom_id', 'teacher_email', 'start_time', 'end_time',
    'time_block', 'is_preferred_slot', 'justification', 'is_override', 'override_justification', 'status', 'closed_by']],
}, {
  urlFetch: (url: string, params: any) => {
    if (caido) return { codigo: 500, texto: '<html>Error</html>' };
    if (url !== URL_CENTRAL) return { codigo: 404, texto: 'no' };
    return { codigo: 200, texto: JSON.stringify(conv.post(JSON.parse(params.payload))) };
  },
});
sal.props.SECRETO_INTRANET = secreto;
const viernes = madrid('2026-10-23', '09:40');
const valeDe = (email: string) => {
  const t = conv.post({ accion: 'login', email, clave: 'clave2026' }).token;
  return conv.post({ accion: 'valeIntranet', token: t, destino: 'salidas' }).vale;
};

console.log('== Sin URL_SERVIDOR_CENTRAL: se usan las pestañas como antes');
let r = sal.pedir({ accion: 'estadoCuenta', email: 'solo.hoja@g.educaand.es' });
ok('el profesorado sale de la pestaña', r.ok && r.registrado === true);
ok('y no se llama al servidor central', sal.peticionesRed.length === 0);

console.log('== Con URL_SERVIDOR_CENTRAL');
sal.props.URL_SERVIDOR_CENTRAL = URL_CENTRAL;
r = sal.pedir({ accion: 'estadoCuenta', email: 'solo.hoja@g.educaand.es' });
ok('quien solo está en la pestaña ya no está dado de alta', r.ok && r.registrado === false);
const pet = sal.peticionesRed[0];
ok('la petición va firmada y por POST al servidor central', !!pet && pet.url === URL_CENTRAL && pet.params.method === 'post'
  && JSON.parse(pet.params.payload).accion === 'datosCentro' && !!JSON.parse(pet.params.payload).peticion.firma);
r = sal.pedir({ accion: 'entrarConVale', vale: valeDe(DOC) });
ok('un docente del centro entra con el acceso único', r.ok && r.usuario.email === DOC && r.usuario.directivo === false, JSON.stringify(r));
ok('su nombre y su tutoría vienen del servidor central', r.usuario.nombre === 'Ap2, Np2' && r.usuario.aula === '1ESO_A');
const tDoc = r.token;
r = sal.pedir({ accion: 'estadoCuenta', email: BAJA });
ok('un docente de baja no está en el profesorado de salidas', r.ok && r.registrado === false);
r = sal.pedir({ accion: 'entrarConVale', vale: valeDe(JEFA) });
ok('el permiso DIRECTIVO del panel llega a salidas', r.ok && r.usuario.directivo === true);
const tJefa = r.token;
ok('se pide una sola vez (caché)', sal.peticionesRed.length === 1, String(sal.peticionesRed.length));

r = sal.pedir({ accion: 'estado', token: tDoc }, viernes);
const alumnos = (r.alumnos || []).map((a: any) => a.id);
ok('el grupo sale del horario del panel (viernes 9:40 → 3ESO_C)', r.ok && r.grupo === '3ESO_C', JSON.stringify({ grupo: r.grupo, alumnos }));
ok('el alumnado del grupo es el del servidor central', alumnos.includes('al-2') && !alumnos.includes('alu_hoja'));
ok('sin teléfonos ni datos de familias', !JSON.stringify(r).includes('600') && !JSON.stringify(r).includes('Madre'));
r = sal.pedir({ accion: 'autorizar', token: tDoc, alumno: 'al-2', grupo: '3ESO_C', justificacion: 'Prueba ficticia' }, viernes);
ok('se autoriza una salida de un alumno del servidor central', r.ok, JSON.stringify(r));

r = sal.pedir({ accion: 'profesorado', token: tJefa });
ok('la lista de profesorado indica que se gestiona en el panel', r.ok && r.central === true && r.profesorado.length === 3);
ok('los grupos salen del alumnado del servidor central', r.ok && r.grupos.join() === '1ESO_A,3ESO_C');
r = sal.pedir({ accion: 'guardarHorario', token: tJefa, filas: [[DOC, 1, '08:30', '09:30', '1ESO_A']] });
ok('el horario ya no se guarda en salidas', !r.ok && r.codigo === 'HORARIO_EN_PANEL');
r = sal.pedir({ accion: 'restablecerClave', token: tJefa, email: DOC });
ok('ni se restablecen contraseñas propias', !r.ok);

console.log('== Cambios en el panel y fallos del servidor central');
conv.post({ accion: 'guardarPermisos', token: tAdmin, email: DOC, permisos: { salidas: 'DIRECTIVO' } });
sal.ctx.limpiarCache();
r = sal.pedir({ accion: 'profesorado', token: tDoc });
ok('al renovar la caché se aplican los permisos nuevos', r.ok);
sal.ctx.limpiarCache();
caido = true;
r = sal.pedir({ accion: 'estado', token: tDoc }, viernes);
ok('si el servidor central falla se avisa (sin volver a la hoja)', !r.ok && r.codigo === 'ERROR_CENTRAL', JSON.stringify(r));
caido = false;
const guardado = sal.props.SECRETO_INTRANET;
sal.props.SECRETO_INTRANET = 'otra-clave';
sal.ctx.limpiarCache();
r = sal.pedir({ accion: 'estadoCuenta', email: DOC });
ok('con una clave distinta el servidor central no entrega datos', !r.ok && r.codigo === 'ERROR_CENTRAL');
sal.props.SECRETO_INTRANET = guardado;
sal.ctx.probarServidorCentral();
ok('probarServidorCentral funciona desde el editor', true);

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
