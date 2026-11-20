// Guardias 1.3.0: modificar una ausencia ya comunicada (añadir o quitar horas) y ver al entrar las guardias
// asignadas del día. Servidor único con el centro ficticio. Solo datos ficticios.
const { crearServidorUnico } = await import('./unico/entorno.mts');
const { DATOS, CUENTAS, filasHorario } = await import('./usuarios/centro.mts');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra && !c ? ' → ' + extra : ''}`); };
const { srv } = crearServidorUnico(JSON.parse(JSON.stringify(DATOS)));
srv.props.set('ID_HOJA_SALIDAS', 'hoja-salidas'); srv.props.set('ID_HOJA_GUARDIAS', 'hoja-guardias');
srv.ctx.guardiasConfigurarHoja(); srv.ctx.salidasConfigurarHoja();
const post = (o: any) => srv.post(o);
const entrar = (email: string) => post({ accion: 'login', email, clave: 'Prueba2026' }).token;
const gua = (accion: string, token: string, d: any = {}) => post({ modulo: 'guardias', accion, token, ...d });
const tAdmin = entrar(CUENTAS.admin);
post({ accion: 'guardarHorarios', token: tAdmin, filas: filasHorario() });
post({ accion: 'guardarPermisos', token: tAdmin, email: CUENTAS.jefatura, permisos: { guardias: 'JEFATURA' } });
const tLu = entrar(CUENTAS.lucia), tJefa = entrar(CUENTAS.jefatura), tCar = entrar(CUENTAS.carmen);
const FECHA = '2027-03-03'; // miércoles futuro

console.log('== Comunicar una ausencia y luego cambiarla');
const clases = gua('misClases', tLu, { fecha: FECHA });
ok('Lucía tiene 4 clases ese día y aún nada comunicado', clases.ok && clases.clases.length === 4 && clases.comunicadas.length === 0, JSON.stringify(clases).slice(0, 300));
const [c1, c2, c3, c4] = clases.clases;
const hora = (c: any) => ({ desde: c.desde, hasta: c.hasta, grupo: c.grupo, aula: c.aula, tarea: 'Tarea ficticia' });
const r = gua('registrarAusencia', tLu, { fecha: FECHA, motivo: 'Médico', horas: [hora(c1), hora(c2)] });
ok('comunica 2 horas', r.ok && r.horas === 2, JSON.stringify(r));
const tras = gua('misClases', tLu, { fecha: FECHA });
ok('al volver a ese día, la app sabe qué horas ya están comunicadas', tras.comunicadas.length === 2 && tras.comunicadas[0].desde === c1.desde && tras.comunicadas[0].idAusencia === r.id);

const add = gua('registrarAusencia', tLu, { fecha: FECHA, ausencia: r.id, horas: [hora(c3)] });
ok('añade una hora más a la misma ausencia', add.ok && add.id === r.id && add.horas === 1, JSON.stringify(add));
const mias = gua('misAusencias', tLu).ausencias;
ok('sigue siendo una sola ausencia, ahora con 3 horas', mias.length === 1 && mias[0].horas.length === 3, JSON.stringify(mias).slice(0, 300));
ok('no puede añadir una hora que ya estaba', gua('registrarAusencia', tLu, { fecha: FECHA, ausencia: r.id, horas: [hora(c1)] }).codigo === 'ERROR_YA_AUSENTE');
ok('no puede añadir horas a la ausencia de otro', !gua('registrarAusencia', tCar, { fecha: FECHA, ausencia: r.id, horas: [hora(c4)] }).ok);

const com = gua('misClases', tLu, { fecha: FECHA }).comunicadas;
const q = gua('quitarHora', tLu, { id: com[1].id });
ok('quita una hora', q.ok && q.ausenciaAnulada === false, JSON.stringify(q));
ok('quedan 2 horas', gua('misAusencias', tLu).ausencias[0].horas.length === 2);
ok('un compañero no puede quitar horas de la ausencia de Lucía', !gua('quitarHora', tCar, { id: com[0].id }).ok);
ok('Jefatura sí puede', gua('quitarHora', tJefa, { id: com[0].id }).ok);
const ultima = gua('misClases', tLu, { fecha: FECHA }).comunicadas;
ok('queda 1 hora', ultima.length === 1, JSON.stringify(ultima));
const q2 = gua('quitarHora', tLu, { id: ultima[0].id });
ok('al quitar la última hora, la ausencia se anula entera', q2.ok && q2.ausenciaAnulada === true && gua('misAusencias', tLu).ausencias.length === 0, JSON.stringify(q2));
ok('y ya no aparece nada en el día', gua('dia', tJefa, { fecha: FECHA }).guardias.length === 0);

console.log('== Guardias hechas y días pasados');
const r2 = gua('registrarAusencia', tLu, { fecha: FECHA, motivo: 'x', horas: [hora(c1), hora(c2)] });
const dia = gua('dia', tJefa, { fecha: FECHA }).guardias;
const cubierta = dia.find((g: any) => g.asignada);
ok('hay una guardia asignada', !!cubierta, JSON.stringify(dia.map((g: any) => g.asignada)));
gua('marcarHecha', tJefa, { id: cubierta.id, hecha: true });
ok('una hora con la guardia ya hecha no se puede quitar', gua('quitarHora', tLu, { id: cubierta.id }).codigo === 'ERROR_YA_HECHA');
const pasada = gua('registrarAusencia', tJefa, { email: CUENTAS.lucia, fecha: '2026-11-18', motivo: 'x', horas: [hora(c1)] });
const comPasada = gua('misClases', tLu, { fecha: '2026-11-18' }).comunicadas;
ok('una ausencia de un día ya pasado no la cambia el docente', pasada.ok && gua('quitarHora', tLu, { id: comPasada[0]?.id }).codigo === 'ERROR_PASADA');
ok('...pero sí Jefatura', gua('quitarHora', tJefa, { id: comPasada[0]?.id }).ok);
gua('anularAusencia', tLu, { id: r2.id });

console.log('== Al entrar: mis guardias del día');
const r3 = gua('registrarAusencia', tLu, { fecha: FECHA, motivo: 'x', horas: [hora(c1), hora(c2), hora(c3), hora(c4)] });
const asignados = gua('dia', tJefa, { fecha: FECHA }).guardias.filter((g: any) => g.asignada);
const quien = asignados[0]?.asignada;
const tQuien = quien === CUENTAS.carmen ? tCar : entrar(quien);
const mg = gua('misGuardias', tQuien, { fecha: FECHA });
ok('quien tiene guardia asignada la ve (hora, grupo, aula y a quién sustituye)', mg.ok && mg.guardias.length >= 1 &&
  mg.guardias.every((g: any) => g.asignada === quien && g.desde && g.grupo && g.ausente), JSON.stringify(mg).slice(0, 300));
ok('...pero no el motivo de la ausencia', mg.guardias.every((g: any) => !g.motivo));
const otro = [CUENTAS.carmen, CUENTAS.javier, CUENTAS.antonio].find((e) => !asignados.some((g: any) => g.asignada === e))!;
ok('quien no tiene ninguna, ve la lista vacía', gua('misGuardias', entrar(otro), { fecha: FECHA }).guardias.length === 0);
ok('sin fecha, se usan las de hoy', gua('misGuardias', tQuien).ok);
gua('anularAusencia', tLu, { id: r3.id });
ok('al anularse la ausencia, desaparecen de sus guardias', gua('misGuardias', tQuien, { fecha: FECHA }).guardias.length === 0);

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
