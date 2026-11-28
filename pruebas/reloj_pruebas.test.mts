// Reloj de pruebas del servidor único: simular día y hora desde la web (solo PRUEBAS). Datos ficticios.
const { crearServidorUnico } = await import('./unico/entorno.mts');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra ? ' → ' + extra : ''}`); };

const ADMIN = 'mgonruz857@g.educaand.es', ANA = 'ana.prueba@g.educaand.es';
const prof = (id: string, email: string, rol = 'ROLE_DOCENTE') =>
  ({ id_profesor: id, email, nombre: 'N' + id, apellidos: 'A' + id, rol, estado: 'ACTIVO' });
const { srv } = crearServidorUnico({
  profesores: [prof('p1', ADMIN, 'ROLE_CONVIVENCIA_ADMIN'), prof('p2', ANA)],
  alumnos: [{ id_alumno: 'al-1', nombre: 'Alumna', apellidos: 'FICTICIA', grupo: '1ESO_A', estado: 'ACTIVO' }],
  sanciones: [], compensaciones: [], audit_logs: [],
});
srv.props.set('ID_HOJA_GUARDIAS', 'hoja-guardias');
srv.props.set('ID_HOJA_SALIDAS', 'hoja-salidas');
srv.ctx.guardiasConfigurarHoja();
srv.ctx.salidasConfigurarHoja();
const post = (o: any) => srv.post(o);
const tAna = post({ accion: 'login', email: ANA, clave: 'clave2026' }).token;
const sal = (accion: string, datos: any = {}) => post({ modulo: 'salidas', accion, token: tAna, ...datos });
const gua = (accion: string, datos: any = {}) => post({ modulo: 'guardias', accion, token: tAna, ...datos });

console.log('== En PRUEBAS');
let r = sal('relojPruebas');
ok('al principio, hora real', r.ok && r.simulado === false, JSON.stringify(r));
ok('sin sesión no se puede tocar el reloj', post({ modulo: 'salidas', accion: 'relojPruebas', token: 'nada', fijar: '2026-11-23 08:45' }).ok === false);
r = sal('relojPruebas', { fijar: '2026-11-23 08:45' });
ok('se simula el lunes 23/11 a 1ª hora', r.ok && r.simulado === true && r.texto === '2026-11-23 08:45', JSON.stringify(r));
r = sal('estado', { grupo: '1ESO_A' });
ok('salidas cree que es 1ª hora: no se sale salvo excepción', r.ok && r.franja.nombre === '1ª hora' && r.franja.restringida === true, JSON.stringify(r.franja));
r = sal('autorizar', { alumno: 'al-1', grupo: '1ESO_A', justificacion: 'Lo necesita' });
ok('...y aplica la norma', r.codigo === 'ERROR_HORA_NO_PERMITIDA', JSON.stringify(r));
r = gua('inicio');
ok('guardias comparte el mismo reloj (hoy es el lunes 23/11)', r.ok && r.hoy === '2026-11-23', JSON.stringify(r));
r = gua('relojPruebas', { fijar: '2026-11-24 13:15' });
ok('también se cambia desde guardias', r.ok && r.texto === '2026-11-24 13:15');
ok('...y salidas lo ve (5ª hora, recomendada)', sal('estado', { grupo: '1ESO_A' }).franja.preferente === true);
ok('una fecha mal escrita se rechaza', sal('relojPruebas', { fijar: 'mañana' }).codigo === 'ERROR_PETICION');
r = sal('relojPruebas', { quitar: true });
ok('se vuelve a la hora real', r.ok && r.simulado === false && Math.abs(r.ahora - Date.now()) < 5000);

console.log('== En PRODUCCIÓN');
sal('relojPruebas', { fijar: '2026-11-23 08:45' });
srv.ctx.ES_PRUEBAS = false;
ok('no existe la acción', sal('relojPruebas').codigo === 'ERROR_ACCION' && gua('relojPruebas', { fijar: '2026-11-23 08:45' }).codigo === 'ERROR_ACCION');
r = gua('inicio');
const hoyReal = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
ok('y aunque quedara un reloj simulado guardado, se usa la hora real', r.ok && r.hoy === hoyReal, r.hoy + ' / ' + hoyReal);

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
