// Importación del alumnado de Séneca al empezar curso: cambios de grupo y bajas de quien ya no figura (datos ficticios).
const mk=()=>{const st=new Map<string,string>();return {getItem:(k:string)=>st.get(k)??null,setItem:(k:string,v:string)=>{st.set(k,String(v))},removeItem:(k:string)=>{st.delete(k)},clear:()=>st.clear(),key:()=>null,length:0}};
const g:any=globalThis; g.localStorage=mk(); g.sessionStorage=mk(); g.window=globalThis; g.CustomEvent=class{constructor(public type:string){}}; g.dispatchEvent=()=>true;
const { crearServidor } = await import('./simulador.mts');
const { generarServidorAppsScript } = await import('../../src/modulos/convivencia/services/appsScriptServidor.ts');
const ADMIN='mgonruz857@g.educaand.es';
const al=(id:string,nombre:string,apellidos:string,grupo:string,nie:string,estado='ACTIVO')=>({id_alumno:id,nombre,apellidos,grupo,nie,puntos_actuales:10,estado});
const srv = crearServidor(generarServidorAppsScript(), {
  profesores:[{id_profesor:'p1',email:ADMIN,nombre:'M',apellidos:'G',rol:'ROLE_CONVIVENCIA_ADMIN',estado:'ACTIVO'}],
  alumnos:[al('a1','Ana','FICTICIA UNO','1ESO_A','N001'), al('a2','Luis','FICTICIO DOS','1ESO_A','N002'),
    al('a3','Eva','FICTICIA TRES','4ESO_A','N003'), al('a4','Pablo','FICTICIO CUATRO','4ESO_A','N004'),
    al('a5','Sara','FICTICIA CINCO','2ESO_B','N005','BAJA')],
  sanciones:[], compensaciones:[], audit_logs:[],
  expedientes_sancion:[{id_expediente:'e1',id_alumno:'a4',completado:false,timestamp:'2026-11-15T10:00:00Z',fecha_creacion:'2026-11-15T10:00:00Z'}],
});
g.fetch = async (_u:string,o:any)=>{ const res=srv.post(JSON.parse(o.body)); return {ok:true,status:200,text:async()=>JSON.stringify(res)}; };
const { AuthService: A } = await import('../../src/modulos/convivencia/services/authService.ts') as any;
const { StorageService: S } = await import('../../src/modulos/convivencia/services/storageService.ts') as any;
const { GoogleDriveSyncService: G } = await import('../../src/modulos/convivencia/services/googleDriveSyncService.ts') as any;
let fallos=0; const ok=(t:string,c:boolean,x='')=>{ if(!c) fallos++; console.log(`${c?'OK   ':'FALLO'} ${t}${x?' → '+x:''}`); };

await A.login(ADMIN,'clave2026',false); await G.pullFromGoogleDrive({forceRefresh:true});

// Archivo de Séneca del curso nuevo: Ana y Luis pasan a 2º (Luis sin NIE en el archivo), Sara vuelve, entra Marta.
// Eva (4º, terminó) y Pablo (4º, con expediente abierto) ya no están.
const filas = [
  {nombre:'Ana',apellidos:'FICTICIA UNO',grupo:'2ESO_A',nie:'N001'},
  {nombre:'Luis',apellidos:'FICTICIO DOS',grupo:'2ESO_B'},
  {nombre:'Sara',apellidos:'FICTICIA CINCO',grupo:'3ESO_A',nie:'N005'},
  {nombre:'Marta',apellidos:'FICTICIA NUEVA',grupo:'1ESO_A',nie:'N006'},
];
const antes = JSON.stringify(S.getAlumnos());
const v = S.previsualizarImportacionAlumnos(filas);
ok('la vista previa no cambia nada', JSON.stringify(S.getAlumnos()) === antes);
ok('detecta un alumno nuevo', v.nuevos.length===1 && v.nuevos[0].nombre==='Marta');
ok('detecta los cambios de grupo (por NIE y por nombre)', v.cambianGrupo.map((c:any)=>c.alumno.id_alumno+':'+c.de+'>'+c.a).sort().join()==='a1:1ESO_A>2ESO_A,a2:1ESO_A>2ESO_B,a5:2ESO_B>3ESO_A', JSON.stringify(v.cambianGrupo.map((c:any)=>c.alumno.id_alumno)));
ok('detecta quien vuelve de baja', v.vuelven.length===1 && v.vuelven[0].id_alumno==='a5');
ok('detecta quien ya no está en Séneca', v.faltan.map((a:any)=>a.id_alumno).sort().join()==='a3,a4');
ok('avisa de quien tiene un expediente abierto', v.conExpedienteAbierto.join()==='a4');

const archivoParcial = S.previsualizarImportacionAlumnos([filas[0]]);
ok('un archivo parcial deja a más de la mitad fuera (la pantalla no marca a nadie)', archivoParcial.faltan.length > archivoParcial.activos/2);

// Se importa marcando solo a Eva (Pablo, con expediente, se deja de alta)
const r = S.importarAlumnosDesdeFilas(filas, ADMIN, { ids:['a3'], motivo:'No figura en Séneca (curso 2027/2028)' });
ok('importa y da de baja solo a quien se ha marcado', r.nuevos===1 && r.bajas===1, JSON.stringify(r));
const est=(id:string)=>S.getAlumnos().find((a:any)=>a.id_alumno===id);
ok('Eva queda de baja con su motivo, sin borrarse', est('a3').estado==='BAJA' && /Séneca/.test(est('a3').motivo_baja));
ok('Pablo (expediente abierto, sin marcar) sigue de alta', est('a4').estado!=='BAJA');
ok('Ana y Luis cambian de grupo sin perder su ficha', est('a1').grupo==='2ESO_A' && est('a2').grupo==='2ESO_B' && est('a2').nie==='N002');
ok('no se puede dar de baja a quien sí está en el archivo', S.importarAlumnosDesdeFilas(filas, ADMIN, { ids:['a1'], motivo:'x' }).bajas===0 && est('a1').estado!=='BAJA');

await G.pushToGoogleDrive(); await new Promise((res)=>setTimeout(res,300));
const db = JSON.parse(srv.drive.archivos['DB']);
const enServidor=(id:string)=>db.alumnos.find((a:any)=>a.id_alumno===id);
ok('los cambios llegan al servidor', enServidor('a3')?.estado==='BAJA' && enServidor('a1')?.grupo==='2ESO_A' && db.alumnos.length===6, JSON.stringify(db.alumnos.map((a:any)=>a.id_alumno+':'+a.estado)));

console.log(fallos?`\n${fallos} FALLO(S)`:'\nTodo correcto');
if (fallos) process.exit(1);
