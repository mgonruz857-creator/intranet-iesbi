// Antes de producción: seguridad y acceso del servidor único (central + salidas + guardias) con el centro ficticio.
// Comprueba quién puede hacer cada acción, qué datos recibe cada perfil, sesiones, bajas, sustituciones,
// intentos de contraseña, firmas entre servidores e inyección de fórmulas en las hojas. Solo datos ficticios.
const { crearServidorUnico } = await import('../unico/entorno.mts');
const { DATOS, CUENTAS, filasHorario } = await import('../usuarios/centro.mts');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra && !c ? ' → ' + extra : ''}`); };
const { srv, libros } = crearServidorUnico(JSON.parse(JSON.stringify(DATOS)));
srv.props.set('ID_HOJA_SALIDAS', 'hoja-salidas'); srv.props.set('ID_HOJA_GUARDIAS', 'hoja-guardias');
srv.ctx.guardiasConfigurarHoja(); srv.ctx.salidasConfigurarHoja();
const post = (o: any) => srv.post(o);
const CLAVE = 'Prueba2026';
const entrar = (email: string, clave = CLAVE) => post({ accion: 'login', email, clave }).token;
const db = () => JSON.parse(srv.drive.archivos['DB']);
const gua = (accion: string, token: string, d: any = {}) => post({ modulo: 'guardias', accion, token, ...d });
const sal = (accion: string, token: string, d: any = {}) => post({ modulo: 'salidas', accion, token, ...d });

const tAdmin = entrar(CUENTAS.admin);
post({ accion: 'guardarHorarios', token: tAdmin, filas: filasHorario() });
post({ accion: 'guardarPermisos', token: tAdmin, email: CUENTAS.jefatura, permisos: { panel: false, salidas: 'DIRECTIVO', guardias: 'JEFATURA' } });
const tJefa = entrar(CUENTAS.jefatura), tCarmen = entrar(CUENTAS.carmen), tJavier = entrar(CUENTAS.javier), tElena = entrar(CUENTAS.elena);

console.log('== 1. Sin sesión o con una sesión falsa no se hace nada');
const ACCIONES_CENTRAL = ['leer', 'guardar', 'panelLeer', 'guardarPermisos', 'guardarHorarios', 'gestionarSustitucion', 'cambiarCurso',
  'leerCursoArchivado', 'resolverHorarioPendiente', 'restablecerClave', 'estadoClaves', 'valeIntranet', 'perfilIntranet',
  'tutoriaVistos', 'marcarTutoriaVista', 'cambiarClave'];
for (const token of ['', 'inventado', tAdmin.slice(0, -2) + 'xx']) {
  const sinPermiso = ACCIONES_CENTRAL.filter((a) => { const r = post({ accion: a, token, data: {}, email: CUENTAS.carmen }); return r.ok; });
  ok(`servidor central con token ${token ? 'falso' : 'vacío'}: ninguna acción responde bien`, sinPermiso.length === 0, sinPermiso.join());
}
const ACC_GUA = ['inicio', 'dia', 'misClases', 'registrarAusencia', 'misAusencias', 'anularAusencia', 'asignar', 'coger', 'marcarHecha', 'recuento', 'miHorario', 'profesorado', 'descargarTarea'];
const ACC_SAL = ['estado', 'autorizar', 'regreso', 'anular', 'historico', 'profesorado', 'guardarHorario'];
ok('guardias sin sesión: todo rechazado', ACC_GUA.every((a) => !gua(a, 'falso').ok));
ok('salidas sin sesión: todo rechazado', ACC_SAL.every((a) => !sal(a, 'falso').ok));
ok('un módulo inventado se rechaza', post({ modulo: 'nominas', accion: 'leer', token: tAdmin }).codigo === 'SIN_MODULO');

console.log('== 2. Un docente no puede hacer lo que es de administración');
const SOLO_ADMIN: [string, any][] = [
  ['panelLeer', {}], ['guardarPermisos', { email: CUENTAS.carmen, permisos: { panel: true } }],
  ['guardarHorarios', { filas: [] }], ['gestionarSustitucion', { operacion: 'iniciar', titular: CUENTAS.javier, nuevo: true, email: 'x.ficticio@g.educaand.es', nombre: 'X', apellidos: 'Y' }],
  ['cambiarCurso', { nuevo: '2027/2028', confirmacion: '2027/2028' }], ['leerCursoArchivado', { curso: '2025/2026' }],
  ['restablecerClave', { email: CUENTAS.javier }], ['estadoClaves', {}], ['resolverHorarioPendiente', { id: 'x' }]];
const dejo = SOLO_ADMIN.filter(([a, d]) => post({ accion: a, token: tCarmen, ...d }).ok);
ok('panel, permisos, horarios, sustituciones, curso, contraseñas: todo PROHIBIDO para un docente', dejo.length === 0, dejo.map((x) => x[0]).join());
ok('Jefatura sin permiso de panel tampoco entra en el panel', !post({ accion: 'panelLeer', token: tJefa }).ok);
ok('guardias: un docente no ve el recuento ni asigna', !gua('recuento', tCarmen).ok && !gua('asignar', tCarmen, { id: 'x', email: CUENTAS.javier }).ok);
ok('guardias: un docente no registra ausencias de otro ni ve su horario',
  !gua('registrarAusencia', tCarmen, { email: CUENTAS.javier, fecha: '2026-11-23', horas: [{ desde: '08:15', hasta: '09:15', grupo: '3ESO_A' }] }).ok &&
  !gua('miHorario', tCarmen, { email: CUENTAS.javier }).ok);
ok('salidas: un docente no ve el histórico de todos', (() => { const r = sal('historico', tCarmen, { fecha: '2026-11-20' }); return !r.ok || (r.salidas || []).every((s: any) => s.docente === CUENTAS.carmen); })());

console.log('== 3. Guardar no sirve para darse permisos ni tocar lo ajeno');
let d = post({ accion: 'leer', token: tCarmen }).data;
const yo = d.profesores.find((p: any) => p.email === CUENTAS.carmen);
yo.rol = 'ROLE_CONVIVENCIA_ADMIN';
d.permisos_intranet = { [CUENTAS.carmen]: { panel: true, guardias: 'JEFATURA', salidas: 'DIRECTIVO' } };
d.horarios = []; d.sustituciones = []; d.curso_actual = d.curso_actual; d.credenciales_profesores = {};
post({ accion: 'guardar', token: tCarmen, data: d });
const tras = db();
ok('un docente no se hace administrador editando su ficha', tras.profesores.find((p: any) => p.email === CUENTAS.carmen).rol === 'ROLE_DOCENTE');
ok('...ni se da permisos de la intranet', !tras.permisos_intranet?.[CUENTAS.carmen]?.panel && post({ accion: 'perfilIntranet', token: tCarmen }).permisos.panel === false);
ok('...ni borra horarios al guardar', tras.horarios.length > 0);
// Parte de Javier; Carmen intenta borrarlo y cambiarlo
d = post({ accion: 'leer', token: tJavier }).data;
d.sanciones.push({ id_sancion: 'p-javier', id_alumno: 'al-3-0', fecha: '2026-11-20', timestamp: '2026-11-20T09:00:00Z', id_profesor: 'p4',
  profesor_email: CUENTAS.javier, nombre_profesor: 'Javier', puntos_restados: 2, codigo_infraccion: 'LEV-PERTURBACION', descripcion_hechos: 'Hechos ficticios' });
ok('Javier pone un parte', post({ accion: 'guardar', token: tJavier, data: d }).ok);
d = post({ accion: 'leer', token: tCarmen }).data;
const ajeno = d.sanciones.find((s: any) => s.id_sancion === 'p-javier');
ok('Carmen ve el parte ajeno sin la descripción de los hechos', !!ajeno && !ajeno.descripcion_hechos);
ajeno.puntos_restados = 10; ajeno.descripcion_hechos = 'cambiado';
post({ accion: 'guardar', token: tCarmen, data: d });
let p = db().sanciones.find((s: any) => s.id_sancion === 'p-javier');
ok('Carmen no puede cambiar el parte de Javier', p.puntos_restados === 2 && p.descripcion_hechos === 'Hechos ficticios');
d = post({ accion: 'leer', token: tCarmen }).data;
d.sanciones = d.sanciones.filter((s: any) => s.id_sancion !== 'p-javier'); d.deleted_sanciones = ['p-javier'];
post({ accion: 'guardar', token: tCarmen, data: d });
ok('...ni borrarlo', !!db().sanciones.find((s: any) => s.id_sancion === 'p-javier' && !s.deleted));

console.log('== 4. Qué datos recibe cada uno');
d = post({ accion: 'leer', token: tCarmen }).data;
const txt = JSON.stringify(d);
ok('el docente no recibe contraseñas, permisos, horarios ni registro de auditoría',
  !/credenciales|salt|hash_clave/i.test(Object.keys(d).join()) && !d.permisos_intranet && !d.horarios && !(d.audit_logs || []).length);
ok('ve teléfonos solo de su tutoría (2º ESO A)', d.alumnos.every((a: any) => a.grupo === '2ESO_A' || !a.telefono_tutor));
ok('no recibe la lista de cursos archivados', d.cursos_archivados === undefined);
ok('ningún hash de contraseña en lo que recibe', !/"clave"|"hash"|"salt"/.test(txt));
const dc = srv.ctx.datosCentroInterno('salidas');
ok('salidas y guardias no reciben teléfonos ni datos de familias', !/telefono|nombre_tutor|600 000 000/.test(JSON.stringify(dc)) &&
  !/telefono|600 000 000/.test(JSON.stringify(srv.ctx.datosCentroInterno('guardias'))));
const lu = entrar(CUENTAS.lucia);
const ausencia = gua('registrarAusencia', lu, { fecha: '2026-11-23', motivo: 'Motivo privado ficticio', horas: [{ desde: '09:15', hasta: '10:15', grupo: '2ESO_A', aula: '103', tarea: 'Tarea' }] });
ok('Lucía registra una ausencia', ausencia.ok, JSON.stringify(ausencia));
ok('el motivo de una ausencia no le llega a otro docente', !JSON.stringify(gua('dia', tCarmen, { fecha: '2026-11-23' })).includes('Motivo privado'));
ok('...y Jefatura sí lo ve', JSON.stringify(gua('dia', tJefa, { fecha: '2026-11-23' })).includes('Motivo privado'));
ok('quien falta no sabe quién le cubre', (() => { const r = gua('dia', lu, { fecha: '2026-11-23' }); return r.ok && r.guardias.every((g: any) => !g.propia || (!g.asignada && !g.sinCubrir)); })());

console.log('== 5. Contraseñas y sesiones');
const claves = [...srv.props.entries()].filter(([k]: any) => String(k).startsWith('CLAVE_'));
ok('las contraseñas se guardan cifradas (con sal), nunca en claro', claves.length >= 5 && claves.every(([, v]: any) => !String(v).includes(CLAVE)) &&
  !JSON.stringify(db()).includes(CLAVE), String(claves.length));
for (let i = 0; i < 5; i++) post({ accion: 'login', email: CUENTAS.antonio, clave: 'Mala' + i });
entrar(CUENTAS.antonio); // primer acceso ya hecho arriba? (si no, el primero fija la clave)
const tAnt = entrar(CUENTAS.antonio);
const malas = [1, 2, 3, 4, 5, 6].map((i) => post({ accion: 'login', email: CUENTAS.antonio, clave: 'Mala2026' + i }));
ok('tras 5 contraseñas equivocadas, la cuenta se bloquea un rato', malas[5].codigo === 'BLOQUEADO', JSON.stringify(malas[5]));
ok('...incluso con la contraseña buena', post({ accion: 'login', email: CUENTAS.antonio, clave: CLAVE }).codigo === 'BLOQUEADO');
ok('el aviso de bloqueo no dice si el correo existe (igual para uno inventado)', (() => {
  const r = post({ accion: 'login', email: 'no.existe.ficticio@g.educaand.es', clave: 'Mala2026' }); return !r.ok && !/no existe|no está registrad/i.test(r.error || ''); })());
ok('correo de fuera de educaand: rechazado', !post({ accion: 'login', email: 'alguien@gmail.com', clave: CLAVE }).ok);
const tCerrar = entrar(CUENTAS.javier);
post({ accion: 'logout', token: tCerrar });
ok('al cerrar sesión el token deja de valer en el central y en los módulos', !post({ accion: 'leer', token: tCerrar }).ok && !gua('inicio', tCerrar).ok && !sal('estado', tCerrar).ok);
ok('otra sesión del mismo docente sigue abierta (otro dispositivo)', post({ accion: 'leer', token: tJavier }).ok);

console.log('== 6. Bajas y sustituciones cortan el acceso al momento');
ok('Elena tenía sesión', post({ accion: 'leer', token: tElena }).ok);
post({ accion: 'gestionarSustitucion', token: tAdmin, operacion: 'iniciar', titular: CUENTAS.elena, nuevo: true, email: CUENTAS.pedro, nombre: 'Pedro', apellidos: 'Sustituto' });
ok('al empezar su sustitución, la sesión abierta de Elena deja de valer (central y módulos)',
  !post({ accion: 'leer', token: tElena }).ok && !gua('inicio', tElena).ok && !sal('estado', tElena).ok);
ok('...y no puede volver a entrar', !post({ accion: 'login', email: CUENTAS.elena, clave: CLAVE }).ok);
ok('...ni sacar un vale para otro servidor', !post({ accion: 'valeIntranet', token: tElena, destino: 'salidas' }).ok);
const tPedro = entrar(CUENTAS.pedro);
ok('Pedro entra y tiene el horario de Elena', !!tPedro && gua('miHorario', tPedro).horas.length > 0);

console.log('== 7. Firmas entre servidores');
ok('datosCentro sin firma: rechazado', !post({ accion: 'datosCentro', peticion: { datos: JSON.stringify({ modulo: 'salidas', exp: Date.now() + 60000 }), firma: 'falsa' } }).ok);
const secreto = 'secreto-ficticio';
srv.props.set('SECRETO_INTRANET', secreto);
const firmar = (datos: string) => srv.ctx.Utilities.base64Encode(srv.ctx.Utilities.computeHmacSha256Signature(datos, secreto));
const caducada = JSON.stringify({ modulo: 'salidas', exp: Date.now() - 1000, n: 'a' });
ok('datosCentro con firma buena pero caducada: rechazado', !post({ accion: 'datosCentro', peticion: { datos: caducada, firma: firmar(caducada) } }).ok);
const buena = JSON.stringify({ modulo: 'salidas', exp: Date.now() + 60000, n: 'b' });
ok('datosCentro con firma buena: responde', post({ accion: 'datosCentro', peticion: { datos: buena, firma: firmar(buena) } }).ok);
const vale = post({ accion: 'valeIntranet', token: tJavier, destino: 'salidas' });
ok('el servidor central firma vales para los módulos', vale.ok && !!vale.vale);

console.log('== 8. Texto peligroso en las hojas (fórmulas)');
srv.props.set('RELOJ_PRUEBAS', JSON.stringify({ real: Date.now(), ficticio: new Date('2026-11-23T08:45:00Z').getTime() }));
const tLucia = lu;
let r = sal('autorizar', tLucia, { alumno: 'al-0-1', grupo: '1ESO_A', justificacion: '=IMPORTXML("http://ejemplo.invalid";"//a")', excepcional: '' });
const celdas = libros['hoja-salidas'].hojas.Historico_Salidas;
const filas: any[][] = celdas ? celdas.datos : [];
ok('salidas: un texto que empieza por "=" no se guarda como fórmula', r.ok ? filas.every((f: any[]) => f.every((v) => typeof v !== 'string' || !v.startsWith('='))) : true,
  JSON.stringify(r).slice(0, 200));
const g = gua('dia', tJefa, { fecha: '2026-11-23' }).guardias?.[0];
if (g) gua('marcarHecha', tJefa, { id: g.id, incidencias: '=HYPERLINK("http://ejemplo.invalid")', hecha: true });
const hg: any[][] = libros['hoja-guardias'].hojas.Guardias.datos;
ok('guardias: las incidencias con "=" no se guardan como fórmula', hg.every((f: any[]) => f.every((v) => typeof v !== 'string' || !v.startsWith('='))));

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
