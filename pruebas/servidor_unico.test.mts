// Servidor único de la intranet: Intranet.gs + Salidas.gs + Guardias.gs en el mismo proyecto (datos ficticios).
import vm from 'node:vm';
const { madrid } = await import('./salidas/simulador.mjs');
const { crearServidorUnico } = await import('./unico/entorno.mts');
const { generarServidorUnico } = await import('../servidores/unico/generar.mts');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra ? ' → ' + extra : ''}`); };

const archivos = generarServidorUnico();

console.log('== Archivos');
// Nombres que cada archivo deja a la vista: no puede haber dos iguales (el último taparía al otro sin avisar)
const nombres: Record<string, string[]> = {};
for (const [archivo, codigo] of Object.entries(archivos)) {
  const ctx: any = {};
  vm.createContext(ctx);
  vm.runInContext(codigo.replace(/^var (MODULO_\w+) = \(function \(\) \{[\s\S]*\}\)\(\);$/m, 'var $1 = {};'), ctx);
  nombres[archivo] = Object.keys(ctx);
}
const repetidos: string[] = [];
const vistos: Record<string, string> = {};
for (const [archivo, lista] of Object.entries(nombres)) {
  for (const n of lista) { if (vistos[n]) repetidos.push(`${n} (${vistos[n]} y ${archivo})`); else vistos[n] = archivo; }
}
ok('ningún nombre repetido entre Intranet.gs, Salidas.gs y Guardias.gs', !repetidos.length, repetidos.join(', '));
ok('solo el servidor central atiende la web (doGet/doPost)', nombres['Intranet.gs'].includes('doPost') &&
  !nombres['Salidas.gs'].includes('doPost') && !nombres['Guardias.gs'].includes('doPost'));
ok('las funciones de editor de los módulos están a la vista con su nombre delante',
  ['salidasConfigurarHoja', 'salidasActivarModoPruebas', 'guardiasConfigurarHoja', 'guardiasProbarServidorCentral'].every((n) => vistos[n]));

const ADMIN = 'mgonruz857@g.educaand.es', JEFA = 'jefatura.prueba@g.educaand.es', ANA = 'ana.prueba@g.educaand.es',
  BEA = 'bea.prueba@g.educaand.es';
const prof = (id: string, email: string, rol = 'ROLE_DOCENTE', extra = {}) =>
  ({ id_profesor: id, email, nombre: 'N' + id, apellidos: 'A' + id, rol, estado: 'ACTIVO', ...extra });

const { srv, libros, red } = crearServidorUnico({
  profesores: [prof('p1', ADMIN, 'ROLE_CONVIVENCIA_ADMIN'), prof('p2', JEFA), prof('p3', ANA, 'ROLE_DOCENTE', { tutor_de_grupo: '1ESO_A' }), prof('p4', BEA),
    prof('p5', 'baja.prueba@g.educaand.es', 'ROLE_DOCENTE', { estado: 'INACTIVO' })],
  alumnos: [{ id_alumno: 'al-1', nombre: 'Alumna', apellidos: 'FICTICIA', grupo: '1ESO_A', estado: 'ACTIVO', telefono_tutor: '600111222', nombre_tutor: 'Madre' }],
  sanciones: [], compensaciones: [], audit_logs: [],
});
const post = (o: any) => srv.post(o);
const entrar = (email: string) => post({ accion: 'login', email, clave: 'clave2026' }).token;
const tAdmin = entrar(ADMIN), tJefa = entrar(JEFA), tAna = entrar(ANA), tBea = entrar(BEA);
const gua = (accion: string, token: string, datos: any = {}) => post({ modulo: 'guardias', accion, token, ...datos });
const sal = (accion: string, token: string, datos: any = {}) => post({ modulo: 'salidas', accion, token, ...datos });

console.log('== Configuración');
let r = gua('misAusencias', tAna);
ok('sin la propiedad ID_HOJA_GUARDIAS se avisa claramente', !r.ok && r.codigo === 'ERROR_CONFIG' && /ID_HOJA_GUARDIAS/.test(r.mensaje), JSON.stringify(r));
srv.props.set('ID_HOJA_GUARDIAS', 'hoja-guardias');
srv.props.set('ID_HOJA_SALIDAS', 'hoja-salidas');
r = post({ modulo: 'otro', accion: 'inicio', token: tAna });
ok('un módulo que no está instalado se rechaza', !r.ok && r.codigo === 'SIN_MODULO');
srv.ctx.guardiasConfigurarHoja();
srv.ctx.salidasConfigurarHoja();
ok('las funciones de editor preparan la hoja de cada módulo', !!libros['hoja-guardias'].hojas.Ausencias && !!libros['hoja-salidas'].hojas.Historico_Salidas);
ok('preparar salidas no crea ni cambia claves del servidor central', !srv.props.has('SECRETO_SERVIDOR') || srv.props.get('SECRETO_SERVIDOR') === srv.ctx.secretoServidor());

console.log('== Permisos y horarios (servidor central)');
ok('Jefatura recibe permisos de guardias y salidas', post({ accion: 'guardarPermisos', token: tAdmin, email: JEFA, permisos: { guardias: 'JEFATURA', salidas: 'DIRECTIVO' } }).ok);
r = post({ accion: 'guardarHorarios', token: tAdmin, filas: [
  [ANA, 1, '08:30', '09:30', '1ESO_A', 'A12'], [ANA, 1, '09:30', '10:30', '1ESO_A', 'A12'],
  [BEA, 1, '08:30', '09:30', 'GUARDIA', ''], [BEA, 1, '09:30', '10:30', 'GUARDIA', ''], [BEA, 1, '11:00', '11:30', 'GUARDIA_RECREO', ''],
  [JEFA, 1, '12:00', '13:00', 'GUARDIA', '']] });
ok('se guardan los horarios', r.ok, JSON.stringify(r));

console.log('== Sesión única');
r = gua('entrarUnico', tAna);
ok('se entra en guardias con la sesión de la intranet, en una sola llamada', r.ok && r.token === tAna && r.usuario.email === ANA && r.usuario.jefatura === false, JSON.stringify(r));
r = gua('entrarUnico', tJefa);
ok('el permiso JEFATURA llega a guardias', r.ok && r.usuario.jefatura === true);
r = sal('entrarUnico', tJefa);
ok('se entra en salidas igual, con el permiso DIRECTIVO', r.ok && r.usuario.directivo === true && r.token === tJefa, JSON.stringify(r));
ok('sin sesión no se entra', gua('inicio', '').codigo === 'NO_AUTH' && sal('estado', 'inventada').codigo === 'NO_AUTH');
r = sal('login', '', { email: ANA, clave: 'otra2026' });
ok('salidas ya no tiene contraseña propia', !r.ok && r.codigo === 'NO_AUTH');
r = sal('restablecerClave', tJefa, { email: ANA });
ok('ni se pueden restablecer contraseñas de salidas', !r.ok && r.codigo === 'ERROR_ACCION');

console.log('== Guardias dentro del servidor único');
const LUNES = '2026-11-23';
r = gua('misClases', tAna, { fecha: LUNES });
ok('el docente ve sus clases (horario del servidor central, sin pasar por la red)', r.ok && r.clases.length === 2, JSON.stringify(r));
r = gua('registrarAusencia', tAna, { fecha: LUNES, motivo: 'Cita médica', horas: [
  { desde: '08:30', hasta: '09:30', grupo: '1ESO_A', aula: 'A12', tarea: 'Ejercicios', archivo: { nombre: 'tarea.pdf', tipo: 'application/pdf', base64: Buffer.from('%PDF ficticio').toString('base64') } }] });
ok('registra una ausencia con archivo', r.ok && r.horas === 1 && r.sinCubrir === undefined, JSON.stringify(r));
r = gua('dia', tJefa, { fecha: LUNES });
ok('Jefatura ve la guardia asignada a Bea', r.ok && r.guardias.length === 1 && r.guardias[0].asignada === BEA && r.guardias[0].motivo === 'Cita médica');
ok('la ausencia se guarda en la hoja de guardias', libros['hoja-guardias'].hojas.Ausencias.getLastRow() === 2);
r = gua('descargarTarea', tBea, { id: r.guardias[0].id });
ok('quien cubre descarga la tarea', r.ok && Buffer.from(r.base64, 'base64').toString() === '%PDF ficticio');
ok('Mi horario funciona', gua('miHorario', tAna).horas.length === 2);

console.log('== Salidas dentro del servidor único');
srv.props.set('RELOJ_PRUEBAS', JSON.stringify({ real: Date.now(), ficticio: madrid(LUNES, '10:45').getTime() }));
r = sal('estado', tAna, { grupo: '1ESO_A' });
ok('el docente ve su grupo con el alumnado del servidor central', r.ok && r.alumnos.length === 1 && r.alumnos[0].id === 'al-1', JSON.stringify(r).slice(0, 300));
ok('...sin teléfonos ni datos de familias', !JSON.stringify(r).includes('600111222'));
r = sal('autorizar', tAna, { alumno: 'al-1', grupo: '1ESO_A', justificacion: 'Lo necesita' });
ok('autoriza una salida y se guarda en la hoja de salidas', r.ok && libros['hoja-salidas'].hojas.Historico_Salidas.getLastRow() === 2, JSON.stringify(r));
r = sal('profesorado', tJefa);
ok('el Equipo Directivo ve el profesorado del centro (gestionado en el panel)', r.ok && r.central === true && r.profesorado.some((p: any) => p.email === ANA));

console.log('== Cambios del panel al momento y errores aislados');
ok('quitar JEFATURA', post({ accion: 'guardarPermisos', token: tAdmin, email: JEFA, permisos: { guardias: 'DOCENTE' } }).ok);
r = gua('entrarUnico', tJefa);
ok('...se nota al momento en guardias (sin esperar 10 minutos)', r.ok && r.usuario.jefatura === false, JSON.stringify(r));
r = gua('registrarAusencia', tAna, { fecha: 'no-es-fecha', horas: [] });
ok('un error de guardias se queda en guardias', !r.ok && r.codigo === 'ERROR_FECHA');
ok('...y convivencia sigue funcionando', post({ accion: 'leer', token: tAdmin }).ok !== false);
ok('nunca se usa la red entre servidores', red.length === 0, red.join(', '));

console.log('== Cierre de sesión');
ok('cerrar sesión desde un módulo', gua('logout', tAna).ok);
ok('...cierra la de toda la intranet', post({ accion: 'perfilIntranet', token: tAna }).codigo === 'NO_AUTH' && sal('estado', tAna).codigo === 'NO_AUTH');

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
