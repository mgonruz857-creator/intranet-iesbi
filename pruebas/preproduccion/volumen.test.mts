// Antes de producción: un curso entero de datos (ficticios) para ver que el servidor y la app aguantan a final de curso.
// Mide el tamaño de los datos y de lo que recibe cada perfil, y el tiempo de leer y guardar en el simulador.
// Los tiempos del simulador no son los de Google, pero sirven para ver si algo crece de forma desproporcionada.
const { crearServidorUnico } = await import('../unico/entorno.mts');
const { CUENTAS } = await import('../usuarios/centro.mts');

let fallos = 0;
const ok = (t: string, c: boolean, extra = '') => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}${extra ? ' (' + extra + ')' : ''}`); };
const kb = (s: string) => Math.round(Buffer.byteLength(s) / 1024);
const ms = (f: () => any) => { const t = Date.now(); const r = f(); return [r, Date.now() - t] as const; };

// Un centro grande: 30 grupos × 25 = 750 alumnos, 80 docentes, 5.000 partes, 1.000 compensaciones, 80 expedientes
const GRUPOS = Array.from({ length: 30 }, (_, i) => `${1 + (i % 4)}ESO_${'ABCDEFGH'[Math.floor(i / 4)]}`);
const profesores = [
  { id_profesor: 'p1', email: CUENTAS.admin, nombre: 'Admin', apellidos: 'Ficticio', rol: 'ROLE_CONVIVENCIA_ADMIN', estado: 'ACTIVO' },
  ...Array.from({ length: 79 }, (_, i) => ({ id_profesor: 'pv' + i, email: `docente${i}.volumen@g.educaand.es`, nombre: 'Docente' + i,
    apellidos: 'Volumen Ficticio', rol: 'ROLE_DOCENTE', estado: 'ACTIVO', departamento: 'Departamento ficticio', tutor_de_grupo: GRUPOS[i] || '' })),
];
const alumnos = GRUPOS.flatMap((g, gi) => Array.from({ length: 25 }, (_, i) => ({ id_alumno: `av-${gi}-${i}`, nombre: 'Alumno' + i,
  apellidos: 'APELLIDO FICTICIO OTRO', grupo: g, nie: `V${gi}${String(i).padStart(5, '0')}`, puntos_actuales: 10, estado: 'ACTIVO',
  nombre_tutor: 'Familia Ficticia', telefono_tutor: '600 000 000', email_tutor: 'familia.ficticia@example.com' })));
const texto = 'Durante la clase el alumno interrumpe repetidamente las explicaciones, no atiende a las indicaciones del profesor y molesta a sus compañeros. ';
const sanciones = Array.from({ length: 5000 }, (_, i) => {
  const a = alumnos[(i * 7) % alumnos.length], p = profesores[1 + (i % 79)];
  const dia = new Date(Date.UTC(2026, 8, 15) + (i % 180) * 86400000).toISOString();
  return { id_sancion: 'sv-' + i, id_alumno: a.id_alumno, fecha: dia.slice(0, 10), timestamp: dia, id_profesor: p.id_profesor,
    profesor_email: p.email, nombre_profesor: p.nombre + ' ' + p.apellidos, puntos_restados: 1 + (i % 3), codigo_infraccion: 'LEV-PERTURBACION',
    descripcion_hechos: texto + texto, materia: 'Materia ficticia', hora: '10:15', estado_pac: i % 5 ? '' : 'ATENDIDO' };
});
const compensaciones = Array.from({ length: 1000 }, (_, i) => ({ id_compensacion: 'cv-' + i, id_alumno: alumnos[(i * 11) % alumnos.length].id_alumno,
  fecha: '2027-02-01', puntos: 1, descripcion: 'Tarea de compensación ficticia', profesor_email: profesores[1 + (i % 79)].email }));
const expedientes_sancion = Array.from({ length: 80 }, (_, i) => ({ id_expediente: 'ev-' + i, id_alumno: alumnos[i * 9].id_alumno, estado: i % 3 ? 'CERRADO' : 'ABIERTO',
  fecha_apertura: '2027-01-10', medidas: texto, documentos: [] }));
const datos = { profesores, alumnos, sanciones, compensaciones, expedientes_sancion, audit_logs: [] };

const { srv } = crearServidorUnico(datos);
const post = (o: any) => srv.post(o);
const tAdmin = post({ accion: 'login', email: CUENTAS.admin, clave: 'Prueba2026' }).token;
const HORAS = [['08:15', '09:15'], ['09:15', '10:15'], ['10:15', '11:15'], ['11:45', '12:45'], ['12:45', '13:45'], ['13:45', '14:45']];
const filas = profesores.flatMap((p, pi) => [1, 2, 3, 4, 5].flatMap((d) => HORAS.map(([a, b], h) => [p.email, d, a, b, (h + pi) % 6 === 5 ? 'GUARDIA' : GRUPOS[(pi + h + d) % 30], '101'])));
const rh = post({ accion: 'guardarHorarios', token: tAdmin, filas });

console.log('== Tamaño de un curso completo');
const dbTexto = srv.drive.archivos['DB'];
const tamDb = kb(dbTexto);
console.log(`   archivo de datos: ${tamDb} KB; ${alumnos.length} alumnos, ${profesores.length} docentes, ${sanciones.length} partes, ${filas.length} horas de horario`);
ok('se guardan los horarios de 80 docentes', rh.ok, rh.ok ? '' : JSON.stringify(rh));
ok('el archivo de datos queda muy por debajo del límite de Drive para leerlo de una vez (50 MB)', tamDb < 20000, tamDb + ' KB');
const trozos = Math.ceil(dbTexto.length / 45000);
ok('la copia rápida en memoria del servidor cabe (menos de 500 trozos de 100 KB)', trozos < 500, trozos + ' trozos');

console.log('== Lo que recibe cada perfil al entrar');
const [lAdmin, tLA] = ms(() => post({ accion: 'leer', token: tAdmin }));
const tDoc = post({ accion: 'login', email: 'docente3.volumen@g.educaand.es', clave: 'Prueba2026' }).token;
const [lDoc, tLD] = ms(() => post({ accion: 'leer', token: tDoc }));
const kA = kb(JSON.stringify(lAdmin)), kD = kb(JSON.stringify(lDoc));
ok(`administración: ${kA} KB en ${tLA} ms`, lAdmin.ok && kA < 15000);
ok(`docente: ${kD} KB en ${tLD} ms`, lDoc.ok && kD < 8000);
const deSuTutoria = new Set(lDoc.data.alumnos.filter((a: any) => a.grupo === GRUPOS[3]).map((a: any) => a.id_alumno));
ok('el docente no recibe los hechos de los partes ajenos, salvo los de su tutoría (por eso pesa menos)', lDoc.data.sanciones
  .filter((s: any) => s.profesor_email !== 'docente3.volumen@g.educaand.es' && !deSuTutoria.has(s.id_alumno)).every((s: any) => !s.descripcion_hechos));
ok('el docente solo ve teléfonos de su tutoría', lDoc.data.alumnos.every((a: any) => a.grupo === GRUPOS[3] || !a.telefono_tutor));

console.log('== Guardar con el archivo lleno');
const tiempos: number[] = [];
for (let i = 0; i < 10; i++) {
  const d = post({ accion: 'leer', token: tDoc }).data;
  d.sanciones.push({ ...sanciones[0], id_sancion: 'nuevo-' + i, profesor_email: 'docente3.volumen@g.educaand.es', id_profesor: 'pv3' });
  const [r, t] = ms(() => post({ accion: 'guardar', token: tDoc, data: { ...d, cambios: { sanciones: ['nuevo-' + i] } } }));
  if (!r.ok) console.log(JSON.stringify(r));
  tiempos.push(t);
}
const medio = Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length);
ok(`un docente guarda 10 partes seguidos: ${medio} ms de media en el simulador`, medio < 3000);
ok('están todos', JSON.parse(srv.drive.archivos['DB']).sanciones.filter((s: any) => s.id_sancion.startsWith('nuevo-')).length === 10);
const dA = post({ accion: 'leer', token: tAdmin }).data;
dA.alumnos[0].grupo = GRUPOS[1];
const [rA, tA] = ms(() => post({ accion: 'guardar', token: tAdmin, data: { ...dA, cambios: { alumnos: [dA.alumnos[0].id_alumno] } } }));
ok(`la administración guarda con el archivo lleno: ${tA} ms`, rA.ok);
const final = JSON.parse(srv.drive.archivos['DB']);
ok('el registro de actividad no crece sin límite (máximo 300 entradas)', final.audit_logs.length <= 300, String(final.audit_logs.length));
ok('guardar no duplica nada', final.sanciones.length === 5010 && final.alumnos.length === 750, `${final.sanciones.length} partes, ${final.alumnos.length} alumnos`);

console.log('== Panel con todo el centro');
const [pl, tP] = ms(() => post({ accion: 'panelLeer', token: tAdmin }));
ok(`el panel carga 80 docentes con sus horarios: ${kb(JSON.stringify(pl))} KB en ${tP} ms`, pl.ok);

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto');
if (fallos) process.exit(1);
