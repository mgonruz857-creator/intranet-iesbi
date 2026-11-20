// Cambio de curso desde el Panel del centro (servidor central, datos ficticios).
const { crearServidor } = await import('./convivencia/simulador.mts');
const { generarServidorAppsScript } = await import('../src/modulos/convivencia/services/appsScriptServidor.ts');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra ? ' → ' + extra : ''}`); };

const ADMIN = 'mgonruz857@g.educaand.es', DOC = 'docente.uno@g.educaand.es', TIT = 'titular.prueba@g.educaand.es',
  SUS = 'sustituto.prueba@g.educaand.es', SUS2 = 'sustituto.dos@g.educaand.es', TIT2 = 'titular.dos@g.educaand.es';
const prof = (id: string, email: string, rol = 'ROLE_DOCENTE', extra = {}) =>
  ({ id_profesor: id, email, nombre: 'N' + id, apellidos: 'A' + id, rol, estado: 'ACTIVO', ...extra });
const parte = (id: string, alumno: string, email = DOC) => ({ id_sancion: id, id_alumno: alumno, fecha: '2026-11-10', timestamp: '2026-11-10T09:00:00Z',
  id_profesor: 'p2', profesor_email: email, nombre_profesor: 'Np2 Ap2', puntos_restados: 3, codigo_infraccion: 'L1' });
const srv = crearServidor(generarServidorAppsScript(), {
  profesores: [prof('p1', ADMIN, 'ROLE_CONVIVENCIA_ADMIN'), prof('p2', DOC, 'ROLE_DOCENTE', { tutor_de_grupo: '1ESO_A' }),
    prof('p3', TIT, 'ROLE_DOCENTE', { tutor_de_grupo: '2ESO_B' }), prof('p4', TIT2)],
  alumnos: [{ id_alumno: 'al-1', nombre: 'Ana', apellidos: 'FICTICIA', grupo: '1ESO_A', estado: 'ACTIVO', puntos_actuales: 4 },
    { id_alumno: 'al-2', nombre: 'Luis', apellidos: 'FICTICIO', grupo: '1ESO_A', estado: 'SANCIONADO', puntos_actuales: 0 },
    { id_alumno: 'al-3', nombre: 'Baja', apellidos: 'FICTICIA', grupo: '1ESO_A', estado: 'BAJA', puntos_actuales: 10 }],
  sanciones: [parte('s1', 'al-1'), parte('s2', 'al-2'), parte('s3', 'al-2')],
  compensaciones: [{ id_compensacion: 'c1', id_alumno: 'al-1', puntos_recuperados: 1, timestamp: '2026-11-12T10:00:00Z' }],
  expedientes_sancion: [
    { id_expediente: 'e-abierto', id_alumno: 'al-2', completado: false, timestamp: '2026-11-15T10:00:00Z', fecha_creacion: '2026-11-15T10:00:00Z' },
    { id_expediente: 'e-cerrado', id_alumno: 'al-1', completado: true, timestamp: '2026-10-01T10:00:00Z', fecha_creacion: '2026-10-01T10:00:00Z' }],
  audit_logs: [],
});
const post = (o: any) => srv.post(o);
const entrar = (email: string) => post({ accion: 'login', email, clave: 'clave2026' }).token;
const tAdmin = entrar(ADMIN), tDoc = entrar(DOC);
entrar(TIT); entrar(TIT2);

console.log('== Antes del cambio');
let r = post({ accion: 'leer', token: tDoc });
ok('el curso actual lo da el servidor (por la fecha, sin haberse cambiado nunca)', r.ok && r.data.curso_actual === '2026/2027', r.data?.curso_actual);
ok('un dispositivo antiguo (sin curso en los datos) guarda como siempre mientras no haya cambio de curso',
  post({ accion: 'guardar', token: tAdmin, data: { ...post({ accion: 'leer', token: tAdmin }).data, curso_actual: undefined } }).ok);
ok('sustitución 1 (el sustituto se irá)', post({ accion: 'gestionarSustitucion', token: tAdmin, operacion: 'iniciar', titular: TIT,
  nuevo: true, email: SUS, nombre: 'Sus', apellidos: 'Prueba' }).ok);
ok('sustitución 2 (el sustituto sigue el curso que viene)', post({ accion: 'gestionarSustitucion', token: tAdmin, operacion: 'iniciar', titular: TIT2,
  nuevo: true, email: SUS2, nombre: 'Sus', apellidos: 'Dos' }).ok);
ok('se cargan horarios', post({ accion: 'guardarHorarios', token: tAdmin, filas: [[DOC, 1, '08:30', '09:30', '1ESO_A']] }).ok);

console.log('== Comprobaciones');
r = post({ accion: 'cambiarCurso', token: tDoc, nuevo: '2027/2028', confirmacion: '2027/2028' });
ok('un docente no puede cambiar de curso', !r.ok && r.codigo === 'PROHIBIDO');
r = post({ accion: 'cambiarCurso', token: tAdmin, nuevo: '2027/2028', confirmacion: '2027-2028' });
ok('hay que escribir exactamente el curso nuevo para confirmar', !r.ok && /exactamente/.test(r.error));
r = post({ accion: 'cambiarCurso', token: tAdmin, nuevo: '2027/2029', confirmacion: '2027/2029' });
ok('el curso nuevo tiene que tener forma de curso', !r.ok && r.codigo === 'DATOS');
r = post({ accion: 'cambiarCurso', token: tAdmin, nuevo: '2025/2026', confirmacion: '2025/2026' });
ok('no se puede volver a un curso anterior', !r.ok && /posterior/.test(r.error));

console.log('== Cambio de curso');
r = post({ accion: 'cambiarCurso', token: tAdmin, nuevo: '2027/2028', confirmacion: '2027/2028', siguen: [SUS2] });
ok('se cambia de curso', r.ok && r.curso === '2027/2028' && r.archivado === '2026/2027' && r.expedientesAbiertos === 1 && r.sustitucionesTerminadas === 2, JSON.stringify(r));
const archivos = srv.drive.archivos;
const copia = Object.keys(archivos).find((k) => k.startsWith('COPIAS') || k.includes('ANTES_CAMBIO_CURSO_2026-2027'));
ok('antes se hace una copia de seguridad completa', !!copia && JSON.parse(archivos[copia!]).sanciones.length === 3, copia);
const arch = JSON.parse(archivos['Curso_2026-2027.json'] || 'null');
ok('el curso cerrado queda en su archivo aparte (alumnado, partes, compensaciones y expedientes)',
  !!arch && arch.sanciones_archivo.length === 3 && arch.alumnos_archivo.length === 3 && arch.compensaciones_archivo.length === 1 && arch.expedientes_archivo.length === 2);
const db = JSON.parse(archivos['DB']);
ok('partes y compensaciones a cero', db.sanciones.length === 0 && db.compensaciones.length === 0);
ok('siguen los expedientes abiertos (y solo esos)', db.expedientes_sancion.length === 1 && db.expedientes_sancion[0].id_expediente === 'e-abierto');
ok('el alumnado se mantiene con 10 puntos y la baja sigue de baja', db.alumnos.length === 3 &&
  db.alumnos.every((a: any) => a.puntos_actuales === 10) && db.alumnos.find((a: any) => a.id_alumno === 'al-3').estado === 'BAJA' &&
  db.alumnos.find((a: any) => a.id_alumno === 'al-2').estado === 'ACTIVO');
ok('los horarios se borran', db.horarios.length === 0);
ok('se quitan todas las tutorías', db.profesores.every((p: any) => !p.tutor_de_grupo));
ok('las sustituciones terminan', db.sustituciones.every((x: any) => x.estado === 'FINALIZADA'));
const est = (e: string) => db.profesores.find((p: any) => p.email === e)?.estado;
ok('el sustituto que no sigue, de baja; el que sigue, activo; los titulares, activos', est(SUS) === 'INACTIVO' && est(SUS2) === 'ACTIVO' && est(TIT) === 'ACTIVO' && est(TIT2) === 'ACTIVO');
ok('el titular vuelve a entrar', !!entrar(TIT));
ok('queda en el registro de auditoría', db.audit_logs[0].entidad === 'CursoEscolar/2027/2028');

console.log('== Después del cambio');
r = post({ accion: 'leer', token: tDoc });
ok('todos los dispositivos ven el curso nuevo', r.data.curso_actual === '2027/2028' && r.data.cursos_archivados === undefined);
r = post({ accion: 'leer', token: tAdmin });
ok('la administración ve la lista de cursos archivados', r.data.cursos_archivados.length === 1 && r.data.cursos_archivados[0].id_curso === '2026/2027');
const viejo = JSON.parse(JSON.stringify(r.data));
viejo.sanciones = [parte('s1', 'al-1')];
viejo.curso_actual = '2026/2027';
r = post({ accion: 'guardar', token: tAdmin, data: viejo });
ok('un dispositivo con el curso anterior no puede guardar (no resucita partes archivados)', !r.ok && r.codigo === 'CURSO_CAMBIADO', JSON.stringify(r));
delete viejo.curso_actual;
ok('...tampoco una versión antigua de la app', post({ accion: 'guardar', token: tAdmin, data: viejo }).codigo === 'CURSO_CAMBIADO');
const nuevoDato = post({ accion: 'leer', token: tAdmin }).data;
nuevoDato.sanciones = [parte('n1', 'al-1')];
r = post({ accion: 'guardar', token: tAdmin, data: nuevoDato });
ok('con el curso nuevo se guarda normal', r.ok && JSON.parse(archivos['DB']).sanciones.length === 1, JSON.stringify(r));
r = post({ accion: 'leerCursoArchivado', token: tAdmin, curso: '2026/2027' });
ok('Analítica lee el curso archivado', r.ok && r.curso.sanciones_archivo.length === 3);
ok('...solo la administración', post({ accion: 'leerCursoArchivado', token: tDoc, curso: '2026/2027' }).codigo === 'PROHIBIDO');
r = post({ accion: 'panelLeer', token: tAdmin });
ok('el panel ve el curso y los archivados', r.curso === '2027/2028' && r.cursosArchivados.length === 1);
r = post({ accion: 'cambiarCurso', token: tAdmin, nuevo: '2028/2029', confirmacion: '2028/2029', vaciarAlumnos: true });
ok('otro curso más, vaciando el alumnado', r.ok && r.alumnos === 1, JSON.stringify(r));
ok('...con vaciar solo queda quien tiene un expediente abierto', JSON.parse(archivos['DB']).alumnos.map((a: any) => a.id_alumno).join() === 'al-2');
ok('...y queda su archivo', !!archivos['Curso_2027-2028.json'] && JSON.parse(archivos['DB']).cursos_archivados.length === 2);

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
