import { createRequire } from 'module';
createRequire(import.meta.url);
// Guardias: reparto con grupos conflictivos (normas del centro, 27/11/2026). Datos ficticios.
const { crearServidor } = await import('./convivencia/simulador.mts');
const { generarServidorAppsScript } = await import('../src/modulos/convivencia/services/appsScriptServidor.ts');
// @ts-ignore simulador en JavaScript
const { crearEntorno } = await import('./salidas/simulador.mjs');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra ? ' → ' + extra : ''}`); };

const D = (n: string) => n + '.prueba@g.educaand.es';
const ADMIN = 'mgonruz857@g.educaand.es', JEFA = D('jefa');
const CONF = D('conflictivo'), TRANQ = D('tranquilo'), FP = D('fp');   // docentes que faltan
const G1 = D('guardia1'), G2 = D('guardia2'), G3 = D('guardia3');     // de guardia a 1ª
const SOLO = D('solo');                                                // único de guardia a 2ª (martes)
const CONF2 = D('cuarto'), TRANQ2 = D('primero'), H1 = D('hugo'), H2 = D('irene'); // jueves y viernes
const prof = (id: string, email: string, rol = 'ROLE_DOCENTE') =>
  ({ id_profesor: id, email, nombre: 'N' + id, apellidos: 'A' + id, rol, estado: 'ACTIVO' });
const conv = crearServidor(generarServidorAppsScript(), {
  profesores: [prof('p0', ADMIN, 'ROLE_CONVIVENCIA_ADMIN'), prof('p1', JEFA), prof('p2', CONF), prof('p3', TRANQ), prof('p4', FP),
    prof('p5', G1), prof('p6', G2), prof('p7', G3), prof('p8', SOLO),
    prof('p9', CONF2), prof('p10', TRANQ2), prof('p11', H1), prof('p12', H2)],
  alumnos: [], sanciones: [], compensaciones: [], audit_logs: [],
});
conv.ctx.crearSecretoIntranet();
const secreto = conv.props.get('SECRETO_INTRANET')!;
const tAdmin = conv.post({ accion: 'login', email: ADMIN, clave: 'clave2026' }).token;
conv.post({ accion: 'guardarPermisos', token: tAdmin, email: JEFA, permisos: { guardias: 'JEFATURA' } });
let r = conv.post({ accion: 'guardarHorarios', token: tAdmin, filas: [
  [CONF, 1, '08:30', '09:30', '3ESO_A', 'C01'], [TRANQ, 1, '08:30', '09:30', '1ESO_B', 'B02'],
  [FP, 2, '09:30', '10:30', '1_FRIO', 'T1'],
  [G1, 1, '08:30', '09:30', 'GUARDIA', ''], [G2, 1, '08:30', '09:30', 'GUARDIA', ''], [G3, 1, '08:30', '09:30', 'GUARDIA', ''],
  [SOLO, 2, '09:30', '10:30', 'GUARDIA', ''],
  [CONF2, 4, '08:30', '09:30', '4ESO_A', 'A04'], [TRANQ2, 5, '08:30', '09:30', '1ESO_C', 'B05'],
  [H1, 4, '08:30', '09:30', 'GUARDIA', ''], [H2, 4, '08:30', '09:30', 'GUARDIA', ''], [H2, 5, '08:30', '09:30', 'GUARDIA', '']] });
ok('horario ficticio guardado', r.ok, JSON.stringify(r));

const gua = crearEntorno({}, {
  codigo: 'guardias',
  urlFetch: (_url: string, params: any) => ({ codigo: 200, texto: JSON.stringify(conv.post(JSON.parse(params.payload))) }),
});
gua.props.SECRETO_INTRANET = secreto;
gua.props.URL_SERVIDOR_CENTRAL = 'https://script.google.com/macros/s/central-ficticio/exec';
const AHORA = new Date('2026-11-19T10:00:00Z');
const pedir = (req: any) => gua.pedir(req, AHORA);
const entrar = (email: string) => {
  const t = conv.post({ accion: 'login', email, clave: 'clave2026' }).token;
  const vale = conv.post({ accion: 'valeIntranet', token: t, destino: 'guardias' }).vale;
  return pedir({ accion: 'entrarConVale', vale }).token;
};
const tJefa = entrar(JEFA);

console.log('== Qué grupos son conflictivos');
const es = gua.ctx.esConflictivo_;
for (const g of ['3ESO_A', '3ESO_C', '4ESO_A', '3º ESO A', '1_FRIO', '2_CALOR', '1_INF', '2_INF', '1FPB', '1º CFGM IFC'])
  ok(g + ' es conflictivo', es(g) === true);
for (const g of ['3ESO_B', '4ESO_B', '1ESO_A', '2BACH_A', '1BACH_C', '', 'GUARDIA'])
  ok((g || '(vacío)') + ' no es conflictivo', es(g) === false);

console.log('== Seis lunes: cada lunes falta un docente de 3º ESO A (conflictivo) y otro de 1º ESO B');
const LUNES = ['2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2027-01-11'];
for (const f of LUNES) {
  r = pedir({ accion: 'registrarAusencia', token: tJefa, email: CONF, fecha: f, motivo: 'x', horas: [{ desde: '08:30', hasta: '09:30', grupo: '3ESO_A', aula: 'C01' }] });
  if (!r.ok || r.sinCubrir) ok('ausencia conflictiva ' + f, false, JSON.stringify(r));
  r = pedir({ accion: 'registrarAusencia', token: tJefa, email: TRANQ, fecha: f, motivo: 'x', horas: [{ desde: '08:30', hasta: '09:30', grupo: '1ESO_B', aula: 'B02' }] });
  if (!r.ok || r.sinCubrir) ok('ausencia normal ' + f, false, JSON.stringify(r));
}
r = pedir({ accion: 'recuento', token: tJefa });
const de = (e: string) => r.docentes.find((d: any) => d.email === e) || { pendientes: 0, hechas: 0, conflictivas: 0 };
const totales = [G1, G2, G3].map((e) => de(e).pendientes + de(e).hechas);
const conflictivas = [G1, G2, G3].map((e) => de(e).conflictivas);
ok('todos quedan compensados en número de guardias (4, 4, 4)', totales.join() === '4,4,4', totales.join());
ok('y en grupos conflictivos (2, 2, 2): no van siempre los mismos', conflictivas.join() === '2,2,2', conflictivas.join());

// Cada docente: nunca le toca el conflictivo dos lunes seguidos
const quien: Record<string, string[]> = {};
for (const f of LUNES) {
  const dia = pedir({ accion: 'dia', token: tJefa, fecha: f });
  quien[f] = dia.guardias.filter((g: any) => g.grupo === '3ESO_A').map((g: any) => g.asignada);
}
const seguidos = LUNES.slice(1).some((f, i) => quien[f][0] === quien[LUNES[i]][0]);
ok('el conflictivo rota: nadie lo cubre dos lunes seguidos', !seguidos, LUNES.map((f) => quien[f][0].split('.')[0]).join(' → '));

console.log('== Antes iba siempre el mismo: jueves 4º ESO A (Hugo o Irene) y viernes 1º ESO C (solo Irene)');
// Con el reparto antiguo (solo el número total, empate alfabético) Hugo cubría 4º ESO A todos los jueves.
const SEMANAS = [['2026-11-26', '2026-11-27'], ['2026-12-03', '2026-12-04'], ['2026-12-10', '2026-12-11'], ['2026-12-17', '2026-12-18']];
const jueves: string[] = [];
for (const [ju, vi] of SEMANAS) {
  r = pedir({ accion: 'registrarAusencia', token: tJefa, email: CONF2, fecha: ju, motivo: 'x', horas: [{ desde: '08:30', hasta: '09:30', grupo: '4ESO_A', aula: 'A04' }] });
  jueves.push(pedir({ accion: 'dia', token: tJefa, fecha: ju }).guardias.find((g: any) => g.grupo === '4ESO_A').asignada.split('.')[0]);
  pedir({ accion: 'registrarAusencia', token: tJefa, email: TRANQ2, fecha: vi, motivo: 'x', horas: [{ desde: '08:30', hasta: '09:30', grupo: '1ESO_C', aula: 'B05' }] });
}
ok('4º ESO A se alterna entre Hugo e Irene', jueves.join() === 'hugo,irene,hugo,irene', jueves.join(' → '));
console.log('== Salvo que no quede otra');
const MARTES = ['2026-11-24', '2026-12-01'];
for (const f of MARTES) {
  r = pedir({ accion: 'registrarAusencia', token: tJefa, email: FP, fecha: f, motivo: 'x', horas: [{ desde: '09:30', hasta: '10:30', grupo: '1_FRIO', aula: 'T1' }] });
  ok('FP el ' + f + ': si solo hay un docente de guardia, va él aunque ya haya ido', r.ok && r.sinCubrir === 0, JSON.stringify(r));
}
r = pedir({ accion: 'recuento', token: tJefa });
ok('...y el recuento lo refleja', r.docentes.find((d: any) => d.email === SOLO).conflictivas === 2);

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
