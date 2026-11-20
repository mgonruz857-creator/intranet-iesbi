/**
 * Centro FICTICIO para simular el uso de la intranet con distintos perfiles de usuario.
 * Ningún dato es real. Lo carga el servidor local con CENTRO_FICTICIO=1 (ver pruebas/usuarios/README.md).
 */
const D = '@g.educaand.es';
export const CUENTAS = {
  admin: 'mgonruz857' + D,
  jefatura: 'rosa.jefatura.ficticia' + D,
  carmen: 'carmen.veterana.ficticia' + D,
  javier: 'javier.joven.ficticio' + D,
  lucia: 'lucia.tutora.ficticia' + D,
  antonio: 'antonio.guardia.ficticio' + D,
  elena: 'elena.titular.ficticia' + D,
  pedro: 'pedro.sustituto.ficticio' + D,
};

const prof = (id: string, email: string, nombre: string, apellidos: string, rol = 'ROLE_DOCENTE', extra = {}) =>
  ({ id_profesor: id, email, nombre, apellidos, rol, estado: 'ACTIVO', ...extra });

const GRUPOS = ['1ESO_A', '1ESO_B', '2ESO_A', '3ESO_A', '4ESO_A', '1BACH_A'];
const NOMBRES = ['Lucía', 'Hugo', 'Martina', 'Mateo', 'Sofía', 'Leo', 'Valeria', 'Daniel', 'Paula', 'Álvaro'];
const APELLIDOS = ['GARCÍA FICTICIO', 'LÓPEZ INVENTADO', 'RUIZ PRUEBA', 'MORENO EJEMPLO', 'DÍAZ SIMULADO',
  'ROMERO FALSO', 'NAVARRO DEMO', 'TORRES MUESTRA', 'GIL ENSAYO', 'VARGAS MODELO'];

export const DATOS = {
  profesores: [
    prof('p1', CUENTAS.admin, 'Administrador', 'Panel Ficticio', 'ROLE_CONVIVENCIA_ADMIN'),
    prof('p2', CUENTAS.jefatura, 'Rosa', 'Jefatura Ficticia', 'ROLE_CONVIVENCIA_ADMIN'),
    prof('p3', CUENTAS.carmen, 'Carmen', 'Veterana Ficticia', 'ROLE_DOCENTE', { tutor_de_grupo: '2ESO_A' }),
    prof('p4', CUENTAS.javier, 'Javier', 'Joven Ficticio'),
    prof('p5', CUENTAS.lucia, 'Lucía', 'Tutora Ficticia', 'ROLE_DOCENTE', { tutor_de_grupo: '1ESO_A' }),
    prof('p6', CUENTAS.antonio, 'Antonio', 'Guardia Ficticio'),
    prof('p7', CUENTAS.elena, 'Elena', 'Titular Ficticia', 'ROLE_DOCENTE', { tutor_de_grupo: '3ESO_A' }),
  ],
  alumnos: GRUPOS.flatMap((g, gi) => NOMBRES.map((n, i) => ({
    id_alumno: `al-${gi}-${i}`, nombre: n, apellidos: APELLIDOS[(i + gi) % APELLIDOS.length], grupo: g,
    nie: `F${gi}${String(i).padStart(5, '0')}`, puntos_actuales: 10, estado: 'ACTIVO',
    nombre_tutor: 'Familia Ficticia', telefono_tutor: '600 000 000',
  }))),
  sanciones: [], compensaciones: [], audit_logs: [],
};

// Horario: 6 horas de 8:15 a 14:45 con recreo de 11:15 a 11:45, de lunes a viernes.
const HORAS: Array<[string, string]> = [['08:15', '09:15'], ['09:15', '10:15'], ['10:15', '11:15'], ['11:45', '12:45'], ['12:45', '13:45'], ['13:45', '14:45']];
/** Cada docente: grupo de cada hora (índice 0-5) o GUARDIA; se repite todos los días con un desplazamiento. */
const PLANTILLA: Record<string, string[]> = {
  carmen: ['2ESO_A', '1ESO_B', '', '2ESO_A', 'GUARDIA', '4ESO_A'],
  javier: ['3ESO_A', '', '1BACH_A', 'GUARDIA', '1ESO_A', '2ESO_A'],
  lucia: ['1ESO_A', '2ESO_A', 'GUARDIA', '1ESO_B', '', '3ESO_A'],
  antonio: ['GUARDIA', '4ESO_A', '1ESO_A', '', '3ESO_A', 'GUARDIA'],
  elena: ['4ESO_A', '3ESO_A', '2ESO_A', '1BACH_A', '1ESO_B', ''],
  jefatura: ['', 'GUARDIA', '4ESO_A', '2ESO_A', '', '1BACH_A'],
};

export function filasHorario(): any[][] {
  const filas: any[][] = [];
  for (const [quien, horas] of Object.entries(PLANTILLA)) {
    for (let dia = 1; dia <= 5; dia++) {
      horas.forEach((_, h) => {
        const g = horas[(h + dia - 1) % horas.length];
        if (g) filas.push([(CUENTAS as any)[quien], dia, HORAS[h][0], HORAS[h][1], g, g === 'GUARDIA' ? '' : String(101 + GRUPOS.indexOf(g))]);
      });
    }
  }
  return filas;
}

/** Deja el centro como estaría a mitad de trimestre: horarios, permisos y una sustitución en marcha. */
export function prepararCentro(srv: any) {
  const post = (o: any) => { const r = srv.post(o); if (!r.ok) throw new Error(o.accion + ': ' + JSON.stringify(r)); return r; };
  const token = post({ accion: 'login', email: CUENTAS.admin, clave: 'Infante2026' }).token;
  post({ accion: 'guardarHorarios', token, filas: filasHorario() });
  post({ accion: 'guardarPermisos', token, email: CUENTAS.jefatura, permisos: { panel: true, salidas: 'DIRECTIVO', guardias: 'JEFATURA' } });
  // Elena está de baja y la sustituye Pedro (nuevo en el centro: primer acceso)
  post({ accion: 'gestionarSustitucion', token, operacion: 'iniciar', titular: CUENTAS.elena, nuevo: true,
    email: CUENTAS.pedro, nombre: 'Pedro', apellidos: 'Sustituto Ficticio' });
  post({ accion: 'logout', token });
}
