// Antes de producción: qué pasa cuando algo falla (Drive, una hoja, un módulo) en el servidor único.
// Lo que cubren otras pruebas: sin conexión y cola del navegador (convivencia/fase2), copias diarias (copias),
// archivo vacío y restauración (restaurar), modo de emergencia (emergencia), servidor ocupado (preproduccion/concurrencia).
const { crearServidorUnico } = await import('../unico/entorno.mts');
const { DATOS, CUENTAS, filasHorario } = await import('../usuarios/centro.mts');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra && !c ? ' → ' + extra : ''}`); };
const { srv, libros } = crearServidorUnico(JSON.parse(JSON.stringify(DATOS)));
srv.props.set('ID_HOJA_SALIDAS', 'hoja-salidas'); srv.props.set('ID_HOJA_GUARDIAS', 'hoja-guardias');
srv.ctx.guardiasConfigurarHoja(); srv.ctx.salidasConfigurarHoja();
const post = (o: any) => srv.post(o);
const entrar = (email: string) => post({ accion: 'login', email, clave: 'Prueba2026' }).token;
const gua = (accion: string, token: string, d: any = {}) => post({ modulo: 'guardias', accion, token, ...d });
const sal = (accion: string, token: string, d: any = {}) => post({ modulo: 'salidas', accion, token, ...d });
const tAdmin = entrar(CUENTAS.admin), tCar = entrar(CUENTAS.carmen);
post({ accion: 'guardarHorarios', token: tAdmin, filas: filasHorario() });
const parte = (id: string) => ({ id_sancion: id, id_alumno: 'al-2-1', fecha: '2026-11-20', timestamp: '2026-11-20T09:00:00Z', id_profesor: 'p3',
  profesor_email: CUENTAS.carmen, nombre_profesor: 'Carmen', puntos_restados: 1, codigo_infraccion: 'LEV-PERTURBACION', descripcion_hechos: 'Ficticio ' + id });
const guardarParte = (id: string) => { const d = post({ accion: 'leer', token: tCar }).data; d.sanciones.push(parte(id)); return post({ accion: 'guardar', token: tCar, data: { ...d, cambios: { sanciones: [id] } } }); };

console.log('== 1. El archivo de datos se estropea (alguien lo edita a mano en Drive)');
ok('antes, un parte se guarda bien', guardarParte('r-1').ok);
const bueno = srv.drive.archivos['DB'];
srv.drive.archivos['DB'] = '{"profesores": [ esto no es válido';
srv.drive.fechas['DB'] = srv.drive.reloj++;
const rl = post({ accion: 'leer', token: tCar });
const rg = guardarParte('r-2');
ok('la app nunca recibe datos vacíos: o un aviso claro o la última copia buena', rl.ok ? rl.data.sanciones.some((s: any) => s.id_sancion === 'r-1') && rl.data.alumnos.length === 60
  : /archivo de datos|administrador/i.test(rl.error || rl.mensaje || ''), JSON.stringify(rl).slice(0, 200));
ok('guardar se niega y NO sobrescribe el archivo (se puede recuperar a mano)', !rg.ok && srv.drive.archivos['DB'].startsWith('{"profesores": [ esto'), JSON.stringify(rg));
ok('salidas y guardias siguen funcionando mientras tanto', sal('estado', tCar).ok && gua('inicio', tCar).ok);
srv.drive.archivos['DB'] = bueno; srv.drive.fechas['DB'] = srv.drive.reloj++;
ok('al reponer el archivo, todo vuelve a funcionar sin perder nada', guardarParte('r-3').ok && JSON.parse(srv.drive.archivos['DB']).sanciones.some((s: any) => s.id_sancion === 'r-1'));

console.log('== 2. Drive escribe un archivo vacío (fallo raro de Google)');
srv.drive.fallosEscritura = 1;
const rv = guardarParte('r-4');
const tras = srv.drive.archivos['DB'] || '';
ok('el servidor lo detecta: o reintenta y queda bien, o avisa del error', (rv.ok && tras.length > 100) || (!rv.ok && !!(rv.error || rv.mensaje)), JSON.stringify(rv) + ' ' + tras.length);
ok('los partes de antes no se pierden', (() => { try { return JSON.parse(srv.drive.archivos['DB']).sanciones.some((s: any) => s.id_sancion === 'r-3'); } catch { return false; } })() ||
  post({ accion: 'leer', token: tCar }).data?.sanciones?.some((s: any) => s.id_sancion === 'r-3'));

console.log('== 3. Alguien borra una pestaña de la hoja de salidas');
srv.props.set('RELOJ_PRUEBAS', JSON.stringify({ real: Date.now(), ficticio: new Date('2026-11-23T08:45:00Z').getTime() }));
const hs = libros['hoja-salidas'].hojas, hist = hs.Historico_Salidas; delete hs.Historico_Salidas;
const rs = sal('autorizar', tCar, { alumno: 'al-2-3', grupo: '2ESO_A', justificacion: 'x' });
ok('salidas da un error controlado (dice qué pestaña falta)', !rs.ok && /Historico_Salidas/.test(rs.error || rs.mensaje || ''), JSON.stringify(rs).slice(0, 200));
ok('convivencia y guardias no se ven afectados', post({ accion: 'leer', token: tCar }).ok && gua('inicio', tCar).ok);
hs.Historico_Salidas = hist;
ok('al reponerla, salidas vuelve sin más', sal('autorizar', tCar, { alumno: 'al-2-3', grupo: '2ESO_A', justificacion: 'x' }).ok);

console.log('== 4. Un error dentro de un módulo no deja el servidor bloqueado');
const hojaG = libros['hoja-guardias'].hojas;
const guardiasHoja = hojaG.Guardias; delete hojaG.Guardias;
const re = gua('dia', tAdmin, { fecha: '2026-11-25' });
ok('guardias sin su pestaña: la vuelve a crear sola (vacía) y sigue respondiendo', re.ok && !!hojaG.Guardias, JSON.stringify(re).slice(0, 200));
hojaG.Guardias = guardiasHoja;
ok('la siguiente petición (de cualquier módulo) funciona: no queda nada bloqueado', guardarParte('r-5').ok && gua('dia', tAdmin, { fecha: '2026-11-25' }).ok);

console.log('== 5. Peticiones mal formadas');
const raras = [{}, { accion: '' }, { accion: 'leer', token: tCar, data: 'texto' }, { accion: 'guardar', token: tCar, data: null },
  { accion: 'guardar', token: tCar, data: { sanciones: 'no es lista' } }, { modulo: 'guardias', accion: 'registrarAusencia', token: tCar, horas: 'x' },
  { modulo: 'salidas', accion: 'autorizar', token: tCar, alumno: { $ne: 1 } }];
let cuelgues = 0;
for (const r of raras) { try { const x = post(r); if (typeof x !== 'object') cuelgues++; } catch { cuelgues++; } }
ok('ninguna petición rara tumba el servidor (todas reciben respuesta)', cuelgues === 0, String(cuelgues));
const fin = JSON.parse(srv.drive.archivos['DB']);
ok('...ni borra datos', fin.sanciones.length >= 3 && fin.alumnos.length === 60 && fin.profesores.length >= 7, `${fin.sanciones.length}/${fin.alumnos.length}/${fin.profesores.length}`);

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
