export interface Usuario {
  email: string;
  nombre: string;
  aula: string;
  directivo: boolean;
}

export interface Franja {
  bloque: 'BLOCK_1' | 'BLOCK_2' | 'RECREO' | 'FUERA';
  preferente: boolean;
  /** 1ª y 4ª hora: no se sale salvo excepción que autoriza el profesor */
  restringida?: boolean;
  nombre: string;
  desde: string;
  hasta: string;
}

export interface Salida {
  exit_id: string;
  alumno: string;
  nombre: string;
  apellidos: string;
  grupo: string;
  /** Edificio del grupo: A (cursos pares y 1º FP Básica) o B (el resto) */
  edificio?: 'A' | 'B';
  docente: string;
  docente_nombre?: string;
  inicio: number;
  fin: number | null;
  hora: string;
  hora_fin: string;
  bloque: string;
  preferente: boolean;
  justificacion: string;
  excepcional: boolean;
  justificacion_excepcional: string;
  estado: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'NO_RETURN';
  cerrado_por: string;
  puede_anular: boolean;
}

export interface AlumnoGrupo {
  id: string;
  nombre: string;
  apellidos: string;
  salidas: { hora: string; docente: string; estado: string }[];
}

export interface Estado {
  ok: true;
  ahora: number;
  usuario: Usuario;
  franja: Franja;
  reloj_simulado: boolean;
  cupo: { global: number; edificio?: number; aula: number; minutos: number; min_justificacion: number; min_excepcional: number };
  grupos: string[];
  grupo: string;
  /** Edificio del grupo elegido ('' si no hay grupo) */
  edificio?: 'A' | 'B' | '';
  grupo_horario: string;
  alumnos: AlumnoGrupo[];
  activas: Salida[];
}

/** "1ESO_A" → "1º ESO A", "2_FRIO" → "2º FRIO" (mismos códigos que convivencia). */
export function etiquetaGrupo(g: string): string {
  let m = /^(\d)(ESO|BACH)_([A-Z])$/.exec(g);
  if (m) return m[1] + 'º ' + m[2] + ' ' + m[3];
  m = /^(\d)_(.+)$/.exec(g);
  if (m) return m[1] + 'º ' + m[2];
  return g;
}

/** Edificio de un grupo: A = cursos pares (2º, 4º…) y 1º de FP Básica; B = el resto (igual que el servidor). */
export function edificioDe(grupo: string): 'A' | 'B' {
  const g = (grupo || '').toUpperCase();
  const m = /^(\d)/.exec(g);
  if (!m) return 'B';
  const curso = Number(m[1]);
  if (curso % 2 === 0) return 'A';
  if (curso === 1 && /(_INF$|FPB)/.test(g)) return 'A';
  return 'B';
}
