// Antes de producción: muchos usuarios a la vez. Cada dispositivo trabaja con datos de hace un rato (los leyó antes de
// que otros guardasen) y envía su lista de cambios, como hace la app. No se debe perder nada. Solo datos ficticios.
const { crearServidorUnico } = await import('../unico/entorno.mts');
const { DATOS, CUENTAS, filasHorario } = await import('../usuarios/centro.mts');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra && !c ? ' → ' + extra : ''}`); };
const datos = JSON.parse(JSON.stringify(DATOS));
const N = 40;
for (let i = 0; i < N; i++) datos.profesores.push({ id_profesor: 'px' + i, email: `docente${i}.ficticio@g.educaand.es`, nombre: 'Docente' + i, apellidos: 'Ficticio', rol: 'ROLE_DOCENTE', estado: 'ACTIVO' });
const { srv, libros } = crearServidorUnico(datos);
srv.props.set('ID_HOJA_SALIDAS', 'hoja-salidas'); srv.props.set('ID_HOJA_GUARDIAS', 'hoja-guardias');
srv.ctx.guardiasConfigurarHoja(); srv.ctx.salidasConfigurarHoja();
const post = (o: any) => srv.post(o);
const entrar = (email: string) => post({ accion: 'login', email, clave: 'Prueba2026' }).token;
const db = () => JSON.parse(srv.drive.archivos['DB']);
const tAdmin = entrar(CUENTAS.admin);
post({ accion: 'guardarHorarios', token: tAdmin, filas: filasHorario() });
const parte = (id: string, email: string, idProf: string, alumno: string) => ({ id_sancion: id, id_alumno: alumno, fecha: '2026-11-20',
  timestamp: '2026-11-20T09:00:00Z', id_profesor: idProf, profesor_email: email, nombre_profesor: 'x', puntos_restados: 2,
  codigo_infraccion: 'LEV-PERTURBACION', descripcion_hechos: 'Hechos ficticios ' + id });
const guardar = (token: string, data: any, cambios: any) => post({ accion: 'guardar', token, data: { ...data, cambios } });

console.log(`== 1. ${N} docentes ponen un parte "a la vez" (todos con los datos leídos antes de que nadie guardase)`);
const sesiones = Array.from({ length: N }, (_, i) => {
  const email = `docente${i}.ficticio@g.educaand.es`, token = entrar(email);
  return { i, email, token, base: post({ accion: 'leer', token }).data };
});
const tAdm2 = tAdmin, baseAdmin = post({ accion: 'leer', token: tAdm2 }).data;
let errores = 0;
for (const s of sesiones) {
  const d = JSON.parse(JSON.stringify(s.base));
  d.sanciones.push(parte('c-' + s.i, s.email, 'px' + s.i, `al-${s.i % 6}-${s.i % 10}`));
  if (!guardar(s.token, d, { sanciones: ['c-' + s.i] }).ok) errores++;
}
ok('ningún guardado falla', errores === 0, String(errores));
ok(`están los ${N} partes`, db().sanciones.filter((x: any) => x.id_sancion.startsWith('c-')).length === N, String(db().sanciones.length));

console.log('== 2. Jefatura, con datos de antes, cambia a un alumno de grupo mientras tanto');
const dA = JSON.parse(JSON.stringify(baseAdmin));
const al = dA.alumnos.find((a: any) => a.id_alumno === 'al-0-0'); al.grupo = '1ESO_B';
ok('Jefatura guarda', guardar(tAdm2, dA, { alumnos: ['al-0-0'] }).ok);
const tras = db();
ok('el cambio de Jefatura queda', tras.alumnos.find((a: any) => a.id_alumno === 'al-0-0').grupo === '1ESO_B');
ok(`...y no se pierde ninguno de los ${N} partes que no tenía`, tras.sanciones.filter((x: any) => x.id_sancion.startsWith('c-')).length === N);

console.log('== 3. Un docente con dos dispositivos');
const s0 = sesiones[0], movil = entrar(s0.email);
let d1 = post({ accion: 'leer', token: s0.token }).data, d2 = post({ accion: 'leer', token: movil }).data;
d1.sanciones.find((x: any) => x.id_sancion === 'c-0').descripcion_hechos = 'Desde el ordenador';
d2.sanciones.push(parte('c-0b', s0.email, 'px0', 'al-1-1'));
guardar(s0.token, d1, { sanciones: ['c-0'] }); guardar(movil, d2, { sanciones: ['c-0b'] });
const t3 = db().sanciones;
ok('el cambio del ordenador y el parte del móvil están, sin duplicados', t3.find((x: any) => x.id_sancion === 'c-0').descripcion_hechos === 'Desde el ordenador' &&
  t3.filter((x: any) => x.id_sancion === 'c-0b').length === 1 && t3.filter((x: any) => x.id_sancion === 'c-0').length === 1);
ok('reenviar el mismo parte (reintento tras un corte) no lo duplica', (guardar(movil, d2, { sanciones: ['c-0b'] }), db().sanciones.filter((x: any) => x.id_sancion === 'c-0b').length === 1));

console.log('== 4. Dos administraciones a la vez en el panel');
const tJefa = entrar(CUENTAS.jefatura);
ok('Jefatura cambia permisos y la administración sube horarios', post({ accion: 'guardarPermisos', token: tJefa, email: CUENTAS.javier, permisos: { salidas: 'DIRECTIVO' } }).ok &&
  post({ accion: 'guardarHorarios', token: tAdmin, filas: [[CUENTAS.carmen, 1, '08:15', '09:15', '2ESO_A', '103']] }).ok);
const t4 = db();
ok('quedan las dos cosas', t4.permisos_intranet[CUENTAS.javier].salidas === 'DIRECTIVO' && t4.horarios.some((f: any) => f[0] === CUENTAS.carmen));
ok('los horarios de los demás no se tocan al subir los de uno', t4.horarios.some((f: any) => f[0] === CUENTAS.javier));

console.log('== 5. Guardias: reparto con varias ausencias a la vez');
post({ accion: 'guardarPermisos', token: tAdmin, email: CUENTAS.jefatura, permisos: { guardias: 'JEFATURA', salidas: 'DIRECTIVO' } });
post({ accion: 'guardarHorarios', token: tAdmin, filas: filasHorario() });
const gua = (accion: string, token: string, d: any = {}) => post({ modulo: 'guardias', accion, token, ...d });
// Miércoles 25/11 a 3ª hora (10:15) está de guardia solo Carmen; faltan Lucía y Javier a esa hora
const lu = entrar(CUENTAS.lucia), tJav0 = entrar(CUENTAS.javier);
const r1 = gua('registrarAusencia', lu, { fecha: '2026-11-25', motivo: 'x', horas: [{ desde: '10:15', hasta: '11:15', grupo: '1ESO_A', aula: '101', tarea: 't' }] });
const r2 = gua('registrarAusencia', tJav0, { fecha: '2026-11-25', motivo: 'y', horas: [{ desde: '10:15', hasta: '11:15', grupo: '1ESO_B', aula: '102', tarea: 't' }] });
ok('se registran las dos ausencias', r1.ok && r2.ok, JSON.stringify([r1, r2]));
const dia = gua('dia', tJefa, { fecha: '2026-11-25' }).guardias || [];
const asignadas = dia.filter((g: any) => g.asignada);
ok('con una sola persona de guardia, una se asigna y la otra queda sin cubrir (nadie con dos guardias a la vez)',
  dia.length === 2 && asignadas.length === 1 && asignadas[0].asignada === CUENTAS.carmen, JSON.stringify(dia.map((g: any) => g.asignada)));
const sinCubrir = dia.find((g: any) => !g.asignada);
const tAnt = entrar(CUENTAS.antonio), tCar0 = entrar(CUENTAS.carmen);
ok('quien no está de guardia a esa hora no puede cogerla', !!sinCubrir && !gua('coger', tAnt, { id: sinCubrir.id }).ok);
ok('Carmen, que ya tiene otra a esa hora, tampoco la duplica', !!sinCubrir && !gua('coger', tCar0, { id: sinCubrir.id }).ok);
ok('Jefatura sí puede asignarla a mano', !!sinCubrir && gua('asignar', tJefa, { id: sinCubrir.id, email: CUENTAS.antonio }).ok);

console.log('== 6. Salidas: dos docentes dejan salir al mismo alumno a la vez');
srv.props.set('RELOJ_PRUEBAS', JSON.stringify({ real: Date.now(), ficticio: new Date('2026-11-23T08:45:00Z').getTime() }));
const sal = (accion: string, token: string, d: any = {}) => post({ modulo: 'salidas', accion, token, ...d });
const tCar = entrar(CUENTAS.carmen), tJav = entrar(CUENTAS.javier);
const a1 = sal('autorizar', tCar, { alumno: 'al-2-3', grupo: '2ESO_A', justificacion: 'Urgente' });
const a2 = sal('autorizar', tJav, { alumno: 'al-2-3', grupo: '2ESO_A', justificacion: 'Urgente' });
ok('el primero la registra', a1.ok, JSON.stringify(a1));
ok('el segundo recibe aviso (ya está fuera) y no se duplica', !a2.ok, JSON.stringify(a2));
const activas = (libros['hoja-salidas'].hojas.Historico_Salidas.datos as any[][]).filter((f) => f[2] === 'al-2-3' && f[13] === 'ACTIVE');
ok('en la hoja hay una sola salida abierta de ese alumno', activas.length <= 1, String(activas.length));

console.log('== 7. Un guardado que encuentra el servidor ocupado');
const original = srv.ctx.LockService.getScriptLock;
srv.ctx.LockService.getScriptLock = () => ({ waitLock: () => { throw new Error('Lock timeout: another process was holding the lock for too long.'); }, releaseLock() {} });
const dOc = post({ accion: 'leer', token: tCar }).data;
dOc.sanciones.push(parte('ocupado', CUENTAS.carmen, 'p3', 'al-2-1'));
const ro = guardar(tCar, dOc, { sanciones: ['ocupado'] });
srv.ctx.LockService.getScriptLock = original;
ok('responde con un error controlado (la app lo reintenta a los 15 s), no se cuelga', !ro.ok && typeof (ro.error || ro.mensaje) === 'string', JSON.stringify(ro));
ok('al reintentar se guarda', guardar(tCar, dOc, { sanciones: ['ocupado'] }).ok && db().sanciones.some((x: any) => x.id_sancion === 'ocupado'));

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
