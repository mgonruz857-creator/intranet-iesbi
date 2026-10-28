// Acceso único: el servidor de convivencia firma un vale y el de salidas lo acepta (datos ficticios).
const { crearServidor } = await import('./convivencia/simulador.mts');
const { generarServidorAppsScript } = await import('../src/modulos/convivencia/services/appsScriptServidor.ts');
// @ts-ignore simulador en JavaScript
const { crearEntorno } = await import('./salidas/simulador.mjs');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra ? ' → ' + extra : ''}`); };

const DOC = 'docente.uno@g.educaand.es', SOLO_CONV = 'solo.convivencia@g.educaand.es';
const conv = crearServidor(generarServidorAppsScript(), { profesores: [
  { id_profesor: 'p1', email: 'mgonruz857@g.educaand.es', nombre: 'Admin', apellidos: 'P', rol: 'ROLE_CONVIVENCIA_ADMIN', estado: 'ACTIVO' },
  { id_profesor: 'p2', email: DOC, nombre: 'Uno', apellidos: 'Docente', rol: 'ROLE_DOCENTE', estado: 'ACTIVO' },
  { id_profesor: 'p3', email: SOLO_CONV, nombre: 'Solo', apellidos: 'Conv', rol: 'ROLE_DOCENTE', estado: 'ACTIVO' },
], alumnos: [], sanciones: [], compensaciones: [], audit_logs: [] });
const sal = crearEntorno({
  Profesorado: [['teacher_id', 'email', 'full_name', 'assigned_classroom_id', 'rol'],
    ['usr_1', 'Docente.Uno@g.educaand.es', 'Uno, Docente', '1ESO_A', 'DOCENTE']],
  Alumnado: [['student_id', 'first_name', 'last_name', 'classroom_id', 'is_active']],
  Historico_Salidas: [['exit_id', 'date', 'student_id', 'classroom_id', 'teacher_email', 'start_time', 'end_time',
    'time_block', 'is_preferred_slot', 'justification', 'is_override', 'override_justification', 'status', 'closed_by']],
});

const tokDoc = conv.post({ accion: 'login', email: DOC, clave: 'clave2026' }).token;
const tokSolo = conv.post({ accion: 'login', email: SOLO_CONV, clave: 'clave2026' }).token;

console.log('== Sin configurar');
let r = conv.post({ accion: 'valeIntranet', token: tokDoc, destino: 'salidas' });
ok('convivencia sin clave secreta no da vales', !r.ok && r.codigo === 'SIN_ACCESO_UNICO');

conv.ctx.crearSecretoIntranet();
const secreto = conv.props.get('SECRETO_INTRANET')!;
ok('crearSecretoIntranet guarda una clave larga', !!secreto && secreto.length >= 60);
ok('...y la muestra en el registro', (conv.drive.logs || []).some((l: string) => l.includes(secreto)));

r = conv.post({ accion: 'valeIntranet', token: tokDoc, destino: 'salidas' });
let s = sal.pedir({ accion: 'entrarConVale', vale: r.vale });
ok('salidas sin clave secreta no acepta vales', !s.ok && s.codigo === 'SIN_ACCESO_UNICO');
sal.props.SECRETO_INTRANET = secreto;

console.log('== Vales');
r = conv.post({ accion: 'valeIntranet', destino: 'salidas' });
ok('sin sesión en convivencia no hay vale', !r.ok && r.codigo === 'NO_AUTH');
r = conv.post({ accion: 'valeIntranet', token: tokDoc, destino: 'otra' });
ok('módulo desconocido se rechaza', !r.ok && r.codigo === 'DESTINO');
r = conv.post({ accion: 'valeIntranet', token: tokDoc, destino: 'salidas' });
ok('con sesión se obtiene un vale', r.ok && !!r.vale?.datos && !!r.vale?.firma);
const vale = r.vale;
s = sal.pedir({ accion: 'entrarConVale', vale });
ok('salidas abre sesión con el vale', s.ok && !!s.token && s.usuario?.email?.toLowerCase() === DOC, JSON.stringify(s));
ok('...y esa sesión sirve', sal.pedir({ accion: 'cambiarClave', token: s.token, actual: 'x', nueva: 'y' }).codigo === 'CLAVE_INCORRECTA');
const est = sal.pedir({ accion: 'profesorado', token: s.token });
ok('...con los permisos de salidas (docente: sin acceso a Profesorado)', !est.ok && est.codigo === 'ERROR_SIN_PERMISO');
s = sal.pedir({ accion: 'entrarConVale', vale });
ok('el mismo vale no se puede usar dos veces', !s.ok && s.codigo === 'VALE_NO_VALIDO');

r = conv.post({ accion: 'valeIntranet', token: tokDoc, destino: 'salidas' });
const cambiado = { datos: r.vale.datos.replace(DOC, SOLO_CONV), firma: r.vale.firma };
s = sal.pedir({ accion: 'entrarConVale', vale: cambiado });
ok('un vale manipulado (otro correo) se rechaza', !s.ok && s.codigo === 'VALE_NO_VALIDO');

r = conv.post({ accion: 'valeIntranet', token: tokDoc, destino: 'guardias' });
s = sal.pedir({ accion: 'entrarConVale', vale: r.vale });
ok('un vale para otro módulo no sirve en salidas', !s.ok && s.codigo === 'VALE_NO_VALIDO');

r = conv.post({ accion: 'valeIntranet', token: tokDoc, destino: 'salidas' });
const realNow = Date.now;
Date.now = () => realNow() + 3 * 60000;
const RealDate = Date;
// @ts-ignore reloj adelantado 3 minutos dentro del servidor de salidas
sal.ctx.Date = class extends RealDate { constructor(...a: any[]) { super(...(a.length ? a : [realNow() + 3 * 60000]) as []); } static now() { return realNow() + 3 * 60000; } };
s = sal.pedir({ accion: 'entrarConVale', vale: r.vale });
ok('un vale caducado (más de 2 minutos) se rechaza', !s.ok && s.codigo === 'VALE_NO_VALIDO', JSON.stringify(s));
sal.ctx.Date = RealDate; Date.now = realNow;

sal.props.SECRETO_INTRANET = 'otra-clave';
r = conv.post({ accion: 'valeIntranet', token: tokDoc, destino: 'salidas' });
s = sal.pedir({ accion: 'entrarConVale', vale: r.vale });
ok('con claves distintas en los dos servidores no entra', !s.ok && s.codigo === 'VALE_NO_VALIDO');
sal.props.SECRETO_INTRANET = secreto;

r = conv.post({ accion: 'valeIntranet', token: tokSolo, destino: 'salidas' });
s = sal.pedir({ accion: 'entrarConVale', vale: r.vale });
ok('quien no está en el Profesorado de salidas no entra', !s.ok && s.codigo === '401_UNAUTHORIZED');

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
