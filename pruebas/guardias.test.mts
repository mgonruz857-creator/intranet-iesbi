import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Guardias: servidor de guardias con el servidor central (convivencia) simulado. Datos ficticios.
const { crearServidor } = await import('./convivencia/simulador.mts');
const { generarServidorAppsScript } = await import('../src/modulos/convivencia/services/appsScriptServidor.ts');
// @ts-ignore simulador en JavaScript
const { crearEntorno } = await import('./salidas/simulador.mjs');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra ? ' → ' + extra : ''}`); };

const D = (n: string) => n + '.prueba@g.educaand.es';
const ADMIN = 'mgonruz857@g.educaand.es', ANA = D('ana'), BEA = D('bea'), CARLOS = D('carlos'), DANI = D('dani'), JEFA = D('jefa'), EVA = D('eva');
const prof = (id: string, email: string, rol = 'ROLE_DOCENTE') =>
  ({ id_profesor: id, email, nombre: 'N' + id, apellidos: 'A' + id, rol, estado: 'ACTIVO' });
const conv = crearServidor(generarServidorAppsScript(), {
  profesores: [prof('p0', ADMIN, 'ROLE_CONVIVENCIA_ADMIN'), prof('p1', ANA), prof('p2', BEA), prof('p3', CARLOS), prof('p4', DANI),
    prof('p5', JEFA), prof('p6', EVA)],
  alumnos: [], sanciones: [], compensaciones: [], audit_logs: [],
});
conv.ctx.crearSecretoIntranet();
const secreto = conv.props.get('SECRETO_INTRANET')!;
const tAdmin = conv.post({ accion: 'login', email: ADMIN, clave: 'clave2026' }).token;
conv.post({ accion: 'guardarPermisos', token: tAdmin, email: JEFA, permisos: { guardias: 'JEFATURA' } });
// Lunes: Ana tiene clase a 1ª y 2ª; Bea de guardia a 1ª y 2ª; Carlos a 1ª; Dani de guardia de recreo; Eva clase a 1ª
let r = conv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [
  [ANA, 1, '08:30', '09:30', '1ESO_A', 'A12'], [ANA, 1, '09:30', '10:30', '2ESO_B', 'B03'],
  [BEA, 1, '08:30', '09:30', 'GUARDIA', ''], [BEA, 1, '09:30', '10:30', 'GUARDIA', ''],
  [CARLOS, 1, '08:30', '09:30', 'GUARDIA', ''], [DANI, 1, '11:30', '12:00', 'GUARDIA_RECREO', ''],
  [EVA, 1, '08:30', '09:30', '3ESO_C', 'C01']] });
ok('el servidor central guarda horas de guardia y aulas', r.ok && r.guardados === 7, JSON.stringify(r));

console.log('== Salidas no recibe las horas de guardia');
const firmar = (modulo: string) => {
  const datos = JSON.stringify({ modulo, exp: Date.now() + 60000, n: 'x' + Math.random() });
  const crypto = require('crypto');
  return { datos, firma: crypto.createHmac('sha256', secreto).update(datos).digest('base64') };
};
r = conv.post({ accion: 'datosCentro', peticion: firmar('salidas') });
ok('datosCentro para salidas: solo clases', r.ok && r.horarios.length === 3 && r.horarios.every((f: any) => !/^GUARDIA/.test(f[4])));
r = conv.post({ accion: 'datosCentro', peticion: firmar('guardias') });
ok('datosCentro para guardias: también guardias, con aula', r.ok && r.horarios.length === 7 && r.horarios[0][5] === 'A12');

const URL_CENTRAL = 'https://script.google.com/macros/s/central-ficticio/exec';
const gua = crearEntorno({}, {
  codigo: 'guardias',
  urlFetch: (url: string, params: any) => ({ codigo: 200, texto: JSON.stringify(conv.post(JSON.parse(params.payload))) }),
});
const AHORA = new Date('2026-11-19T10:00:00Z');
const LUNES = '2026-11-23';
const pedir = (req: any) => gua.pedir(req, AHORA);
const entrar = (email: string) => {
  const t = conv.post({ accion: 'login', email, clave: 'clave2026' }).token;
  const vale = conv.post({ accion: 'valeIntranet', token: t, destino: 'guardias' }).vale;
  return pedir({ accion: 'entrarConVale', vale });
};

console.log('== Configuración y acceso');
r = entrar(ANA);
ok('sin SECRETO_INTRANET no se entra', !r.ok && r.codigo === 'SIN_ACCESO_UNICO');
gua.props.SECRETO_INTRANET = secreto;
r = entrar(ANA);
ok('sin URL_SERVIDOR_CENTRAL se avisa', !r.ok && r.codigo === 'ERROR_CENTRAL');
gua.props.URL_SERVIDOR_CENTRAL = URL_CENTRAL;
r = entrar(ANA);
ok('un docente entra con el acceso único', r.ok && r.usuario.email === ANA && r.usuario.jefatura === false, JSON.stringify(r));
const tAna = r.token;
const tBea = entrar(BEA).token, tCarlos = entrar(CARLOS).token, tDani = entrar(DANI).token, tEva = entrar(EVA).token;
r = entrar(JEFA);
ok('el permiso JEFATURA del panel llega a guardias', r.ok && r.usuario.jefatura === true);
const tJefa = r.token;
ok('una sesión inventada no vale', pedir({ accion: 'inicio', token: 'nada' }).codigo === 'NO_AUTH');

console.log('== Ausencia y reparto');
r = pedir({ accion: 'misClases', token: tAna, fecha: LUNES });
ok('el docente ve sus clases del día (sin guardias), con grupo y aula', r.ok && r.clases.length === 2 && r.clases[0].grupo === '1ESO_A' && r.clases[0].aula === 'A12');
r = pedir({ accion: 'misClases', token: tAna, fecha: '2026-11-22' });
ok('un domingo no es día lectivo', !r.ok && r.codigo === 'ERROR_FECHA');
r = pedir({ accion: 'misClases', token: tAna, fecha: LUNES, email: EVA });
ok('un docente no puede ver las clases de otro', !r.ok && r.codigo === 'ERROR_SIN_PERMISO');
const pdf = Buffer.from('%PDF-1.4 tarea ficticia').toString('base64');
r = pedir({ accion: 'registrarAusencia', token: tAna, fecha: LUNES, motivo: 'Cita médica', horas: [
  { desde: '08:30', hasta: '09:30', grupo: '1ESO_A', aula: 'A12', tarea: 'Ejercicios 1 a 5, página 40',
    archivo: { nombre: 'tarea.pdf', tipo: 'application/pdf', base64: pdf } },
  { desde: '09:30', hasta: '10:30', grupo: '2ESO_B', aula: 'B03', tarea: 'Lectura del tema 3' }] });
ok('se registra la ausencia con tarea y archivo', r.ok && r.horas === 2 && r.sinCubrir === 0, JSON.stringify(r));
const idAusAna = r.id;
r = pedir({ accion: 'registrarAusencia', token: tAna, fecha: LUNES, motivo: '', horas: [{ desde: '09:00', hasta: '10:00', tarea: '' }] });
ok('no se puede registrar dos veces la misma hora', !r.ok && r.codigo === 'ERROR_YA_AUSENTE');
r = pedir({ accion: 'registrarAusencia', token: tAna, fecha: LUNES, horas: [] });
ok('hace falta al menos una hora', !r.ok && r.codigo === 'ERROR_SIN_HORAS');

let dia = pedir({ accion: 'dia', token: tCarlos, fecha: LUNES });
const g1 = dia.guardias.find((g: any) => g.desde === '08:30'), g2 = dia.guardias.find((g: any) => g.desde === '09:30');
ok('1ª hora: a quien menos lleva (empate → Bea)', g1 && g1.asignada === BEA, JSON.stringify(dia.guardias.map((g: any) => [g.desde, g.asignada])));
ok('2ª hora: la única de guardia (Bea)', g2 && g2.asignada === BEA);
ok('los demás no ven el motivo', g1 && g1.motivo === undefined && g1.ausente === 'Ap1, Np1');
ok('...pero sí la tarea, el grupo y el aula', g1.tarea.startsWith('Ejercicios') && g1.grupo === '1ESO_A' && g1.aula === 'A12' && g1.archivo === 'tarea.pdf');
ok('Jefatura ve el motivo', pedir({ accion: 'dia', token: tJefa, fecha: LUNES }).guardias[0].motivo === 'Cita médica');
ok('el docente ausente ve su motivo', pedir({ accion: 'misAusencias', token: tAna }).ausencias[0].motivo === 'Cita médica');
const recreo = dia.cuadrante.find((f: any) => f.recreo);
ok('el cuadrante del día incluye la guardia de recreo', !!recreo && recreo.docentes[0].email === DANI && dia.cuadrante.length === 3);
r = pedir({ accion: 'descargarTarea', token: tCarlos, id: g1.id });
ok('la tarea en archivo se descarga', r.ok && r.base64 === pdf && r.nombre === 'tarea.pdf');

r = pedir({ accion: 'registrarAusencia', token: tJefa, email: EVA, fecha: LUNES, motivo: 'Formación', horas: [
  { desde: '08:30', hasta: '09:30', grupo: '3ESO_C', aula: 'C01', tarea: 'Repasar' }] });
ok('Jefatura registra la ausencia de otro docente; va a Carlos (Bea ya está ocupada)', r.ok && r.sinCubrir === 0);
dia = pedir({ accion: 'dia', token: tJefa, fecha: LUNES });
const gEva = dia.guardias.find((g: any) => g.ausenteEmail === EVA);
ok('...asignada a Carlos', gEva && gEva.asignada === CARLOS);
r = pedir({ accion: 'registrarAusencia', token: tAna, email: EVA, fecha: LUNES, horas: [{ desde: '12:00', hasta: '13:00' }] });
ok('un docente no puede registrar ausencias de otro', !r.ok && r.codigo === 'ERROR_SIN_PERMISO');

console.log('== Registro de la guardia');
r = pedir({ accion: 'marcarHecha', token: tCarlos, id: g1.id, incidencias: '' });
ok('no se puede marcar una guardia de otro', !r.ok && r.codigo === 'ERROR_SIN_PERMISO');
r = pedir({ accion: 'marcarHecha', token: tBea, id: g1.id, incidencias: 'Dos alumnos sin material' });
ok('quien la cubre la marca como hecha con incidencias', r.ok);
dia = pedir({ accion: 'dia', token: tBea, fecha: LUNES });
const g1b = dia.guardias.find((g: any) => g.id === g1.id);
ok('...y queda registrada', g1b.estado === 'HECHA' && g1b.incidencias === 'Dos alumnos sin material' && g1b.mia === true);

console.log('== Cambios: Jefatura, coger y nuevas ausencias');
r = pedir({ accion: 'asignar', token: tCarlos, id: g2.id, email: '' });
ok('solo Jefatura cambia la asignación', !r.ok && r.codigo === 'ERROR_SIN_PERMISO');
r = pedir({ accion: 'asignar', token: tJefa, id: g2.id, email: '' });
ok('Jefatura la deja sin cubrir', r.ok);
r = pedir({ accion: 'coger', token: tDani, id: g2.id });
ok('quien no está de guardia a esa hora no puede cogerla', !r.ok && r.codigo === 'ERROR_NO_ES_DE_GUARDIA');
r = pedir({ accion: 'coger', token: tBea, id: g2.id });
ok('el docente de guardia la coge', r.ok);
r = pedir({ accion: 'coger', token: tBea, id: g2.id });
ok('una guardia asignada no se puede volver a coger', !r.ok && r.codigo === 'ERROR_YA_ASIGNADA');
r = pedir({ accion: 'registrarAusencia', token: tBea, fecha: LUNES, motivo: 'Asuntos propios', horas: [{ desde: '11:00', hasta: '12:00' }] });
ok('si quien cubre se ausenta ese día, sus guardias pendientes se reparten de nuevo', r.ok && r.reasignadas === 1, JSON.stringify(r));
dia = pedir({ accion: 'dia', token: tJefa, fecha: LUNES });
ok('...y la 2ª hora queda sin cubrir (no hay nadie más libre)', dia.guardias.find((g: any) => g.id === g2.id).asignada === '');
ok('la ya hecha no cambia', dia.guardias.find((g: any) => g.id === g1.id).asignada === BEA);

console.log('== Recuento y anulación');
r = pedir({ accion: 'recuento', token: tBea });
ok('el recuento es solo para Jefatura', !r.ok && r.codigo === 'ERROR_SIN_PERMISO');
r = pedir({ accion: 'recuento', token: tJefa });
const cBea = r.docentes.find((d: any) => d.email === BEA), cCarlos = r.docentes.find((d: any) => d.email === CARLOS);
ok('cuenta las guardias del curso desde el 1 de septiembre', r.ok && r.desde === '2026-09-01' && cBea.hechas === 1 && cCarlos.pendientes === 1,
  JSON.stringify(r.docentes));
r = pedir({ accion: 'anularAusencia', token: tCarlos, id: idAusAna });
ok('otro docente no puede anular la ausencia', !r.ok && r.codigo === 'ERROR_SIN_PERMISO');
r = pedir({ accion: 'anularAusencia', token: tAna, id: idAusAna });
ok('el propio docente la anula', r.ok);
dia = pedir({ accion: 'dia', token: tJefa, fecha: LUNES });
ok('sus guardias desaparecen del día', !dia.guardias.some((g: any) => g.ausenteEmail === ANA));
ok('nunca llegan teléfonos ni datos de familias', !JSON.stringify(gua.peticionesRed).includes('telefono'));
gua.ctx.probarServidorCentral();

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
