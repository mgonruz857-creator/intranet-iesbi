// Antes de producción: quién entra y a qué. Matriz de perfiles × apartados, primer acceso, contraseñas olvidadas,
// bajas, fin de sustitución, permisos que cambian con la sesión abierta y sesiones que caducan. Solo datos ficticios.
const { crearServidorUnico } = await import('../unico/entorno.mts');
const { DATOS, CUENTAS, filasHorario } = await import('../usuarios/centro.mts');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra && !c ? ' → ' + extra : ''}`); };
const { srv } = crearServidorUnico(JSON.parse(JSON.stringify(DATOS)));
srv.props.set('ID_HOJA_SALIDAS', 'hoja-salidas'); srv.props.set('ID_HOJA_GUARDIAS', 'hoja-guardias');
srv.ctx.guardiasConfigurarHoja(); srv.ctx.salidasConfigurarHoja();
const post = (o: any) => srv.post(o);
const CLAVE = 'Prueba2026';
const login = (email: string, clave = CLAVE) => post({ accion: 'login', email, clave });
const entrar = (email: string, clave = CLAVE) => login(email, clave).token;
const db = () => JSON.parse(srv.drive.archivos['DB']);
const gua = (accion: string, token: string, d: any = {}) => post({ modulo: 'guardias', accion, token, ...d });
const sal = (accion: string, token: string, d: any = {}) => post({ modulo: 'salidas', accion, token, ...d });

const tAdmin = entrar(CUENTAS.admin);
post({ accion: 'guardarHorarios', token: tAdmin, filas: filasHorario() });
post({ accion: 'guardarPermisos', token: tAdmin, email: CUENTAS.jefatura, permisos: { panel: true, salidas: 'DIRECTIVO', guardias: 'JEFATURA' } });

console.log('== 1. Primer acceso');
const pa = login(CUENTAS.antonio, 'corta');
ok('una contraseña demasiado sencilla no vale para el primer acceso', !pa.ok, JSON.stringify(pa));
const pa2 = login(CUENTAS.antonio);
ok('con una contraseña válida entra y la app sabe que es su primer acceso', pa2.ok && pa2.primerAcceso === true, JSON.stringify(pa2).slice(0, 200));
ok('la segunda vez ya no es primer acceso', login(CUENTAS.antonio).primerAcceso === false);
ok('...y otra contraseña ya no vale', !login(CUENTAS.antonio, 'OtraClave2026').ok);
ok('un correo que no está en el claustro no entra (aunque sea educaand)', login('nadie.ficticio@g.educaand.es').codigo === 'NO_REGISTRADO');
ok('las mayúsculas y espacios del correo no importan', login('  ' + CUENTAS.antonio.toUpperCase() + ' ').ok);

console.log('== 2. Qué ve cada perfil (portada de la intranet)');
const perfil = (email: string) => post({ accion: 'perfilIntranet', token: entrar(email) }).permisos;
const matriz: Array<[string, string, any]> = [
  ['Administrador', CUENTAS.admin, { panel: true, convivencia: 'ADMIN', salidas: 'DOCENTE', guardias: 'DOCENTE' }],
  ['Jefatura', CUENTAS.jefatura, { panel: true, convivencia: 'ADMIN', salidas: 'DIRECTIVO', guardias: 'JEFATURA' }],
  ['Docente (Carmen)', CUENTAS.carmen, { panel: false, convivencia: 'DOCENTE', salidas: 'DOCENTE', guardias: 'DOCENTE' }],
  ['Docente (Javier)', CUENTAS.javier, { panel: false, convivencia: 'DOCENTE', salidas: 'DOCENTE', guardias: 'DOCENTE' }],
];
for (const [quien, email, esperado] of matriz) {
  const p = perfil(email);
  ok(`${quien}: ${Object.entries(esperado).map(([k, v]) => k + '=' + v).join(', ')}`, Object.entries(esperado).every(([k, v]) => p[k] === v), JSON.stringify(p));
}
const tCar = entrar(CUENTAS.carmen), tJefa = entrar(CUENTAS.jefatura);
ok('Jefatura entra en el panel; Carmen no', post({ accion: 'panelLeer', token: tJefa }).ok && post({ accion: 'panelLeer', token: tCar }).codigo === 'PROHIBIDO');
ok('Jefatura ve el recuento de guardias; Carmen no', gua('recuento', tJefa, { desde: '2026-11-01', hasta: '2026-11-30' }).ok && !gua('recuento', tCar, { desde: '2026-11-01', hasta: '2026-11-30' }).ok);
ok('todo docente entra en salidas y guardias con la misma sesión', sal('estado', tCar).ok && gua('inicio', tCar).ok);
ok('un permiso inventado no da nada (se queda en DOCENTE)', post({ accion: 'guardarPermisos', token: tAdmin, email: CUENTAS.javier, permisos: { guardias: 'SUPERADMIN' } }).ok
  ? perfil(CUENTAS.javier).guardias === 'DOCENTE' : true);

console.log('== 3. Permisos que cambian con la sesión abierta');
const tJav = entrar(CUENTAS.javier);
post({ accion: 'guardarPermisos', token: tAdmin, email: CUENTAS.javier, permisos: { panel: true, guardias: 'JEFATURA' } });
ok('al darle el panel a Javier, lo tiene al momento sin volver a entrar', post({ accion: 'panelLeer', token: tJav }).ok && gua('inicio', tJav).usuario?.jefatura === true);
post({ accion: 'guardarPermisos', token: tAdmin, email: CUENTAS.javier, permisos: { panel: false, guardias: 'DOCENTE' } });
ok('al quitárselo, lo pierde al momento', !post({ accion: 'panelLeer', token: tJav }).ok && gua('inicio', tJav).usuario?.jefatura === false);
ok('nadie se puede quitar el panel a sí mismo por error (o queda otro administrador)', (() => {
  const r = post({ accion: 'guardarPermisos', token: tAdmin, email: CUENTAS.admin, permisos: { panel: false } });
  const sigue = post({ accion: 'panelLeer', token: tAdmin }).ok || post({ accion: 'panelLeer', token: tJefa }).ok;
  if (r.ok) post({ accion: 'guardarPermisos', token: tJefa, email: CUENTAS.admin, permisos: { panel: true } });
  return sigue;
})());

console.log('== 4. Contraseña olvidada');
const tLu = entrar(CUENTAS.lucia), tLuMovil = entrar(CUENTAS.lucia);
ok('Carmen (docente) no puede restablecer la contraseña de otro', !post({ accion: 'restablecerClave', token: tCar, email: CUENTAS.lucia }).ok);
ok('Jefatura restablece la de Lucía', post({ accion: 'restablecerClave', token: tJefa, email: CUENTAS.lucia }).ok);
ok('las sesiones abiertas de Lucía (ordenador y móvil) se cierran', !post({ accion: 'leer', token: tLu }).ok && !post({ accion: 'leer', token: tLuMovil }).ok && !gua('inicio', tLu).ok);
const nueva = login(CUENTAS.lucia, 'Nueva2026Lucia');
ok('Lucía entra con una contraseña nueva (como primer acceso)', nueva.ok && nueva.primerAcceso === true);
ok('...y la antigua ya no vale', !login(CUENTAS.lucia, CLAVE).ok);
const tLu2 = nueva.token;
ok('cambiar la contraseña exige la actual', !post({ accion: 'cambiarClave', token: tLu2, actual: 'mal', nueva: 'Otra2026Lucia' }).ok &&
  post({ accion: 'cambiarClave', token: tLu2, actual: 'Nueva2026Lucia', nueva: 'Otra2026Lucia' }).ok && login(CUENTAS.lucia, 'Otra2026Lucia').ok);

console.log('== 5. Baja definitiva de un docente');
const tAnt = entrar(CUENTAS.antonio);
const d = post({ accion: 'leer', token: tAdmin }).data;
const ant = d.profesores.find((p: any) => p.email === CUENTAS.antonio); ant.estado = 'INACTIVO';
ok('la administración da de baja a Antonio', post({ accion: 'guardar', token: tAdmin, data: { ...d, cambios: { profesores: [ant.email] } } }).ok);
ok('su sesión abierta deja de valer en todo', !post({ accion: 'leer', token: tAnt }).ok && !gua('inicio', tAnt).ok && !sal('estado', tAnt).ok);
ok('no puede volver a entrar (aviso claro de baja)', login(CUENTAS.antonio).codigo === 'BAJA');
ok('su ficha sigue en los datos (histórico)', db().profesores.some((p: any) => p.email === CUENTAS.antonio));

console.log('== 6. Sustitución: empieza, cambia de sustituto y termina');
post({ accion: 'gestionarSustitucion', token: tAdmin, operacion: 'iniciar', titular: CUENTAS.elena, nuevo: true, email: CUENTAS.pedro, nombre: 'Pedro', apellidos: 'Sustituto' });
const tPedro = entrar(CUENTAS.pedro);
ok('el sustituto entra (primer acceso) y hereda la tutoría', !!tPedro && db().profesores.find((p: any) => p.email === CUENTAS.pedro).tutor_de_grupo === '3ESO_A');
ok('el sustituto ve teléfonos de su tutoría heredada', post({ accion: 'leer', token: tPedro }).data.alumnos.some((a: any) => a.grupo === '3ESO_A' && a.telefono_tutor));
const sus = db().sustituciones.find((x: any) => x.estado === 'ACTIVA');
post({ accion: 'gestionarSustitucion', token: tAdmin, operacion: 'finalizar', id: sus.id, bajaSustituto: true });
ok('al volver la titular, Elena entra de nuevo', login(CUENTAS.elena).ok);
ok('...recupera su tutoría', db().profesores.find((p: any) => p.email === CUENTAS.elena).tutor_de_grupo === '3ESO_A');
ok('...y el sustituto dado de baja pierde el acceso al momento', !post({ accion: 'leer', token: tPedro }).ok && login(CUENTAS.pedro).codigo === 'BAJA');

console.log('== 7. Sesiones que caducan');
const tCad = entrar(CUENTAS.carmen);
const cache = srv.ctx.CacheService.getScriptCache();
cache.remove('SES_' + tCad);
ok('una sesión caducada pide volver a entrar en todos los apartados', post({ accion: 'leer', token: tCad }).codigo === 'NO_AUTH' &&
  gua('inicio', tCad).codigo === 'NO_AUTH' && sal('estado', tCad).codigo === 'NO_AUTH');
ok('el aviso es comprensible', /iniciar sesión|caducado/i.test(post({ accion: 'leer', token: tCad }).error || post({ accion: 'leer', token: tCad }).mensaje || ''));

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
