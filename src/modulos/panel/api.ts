/** El panel habla con el servidor central (el de convivencia) con la sesión de la intranet. */
import { AuthService } from '../convivencia/services/authService';
import { llamarApi as llamar, type RespuestaApi } from '../convivencia/services/apiService';
import { LISTA_GRUPOS_OFICIALES } from '../convivencia/types/convivencia';
import type { PermisosIntranet } from '../../nucleo/accesoUnico';

export type { PermisosIntranet };

export interface DocentePanel {
  email: string;
  nombre: string;
  apellidos: string;
  tutor_de_grupo?: string;
  estado?: 'ACTIVO' | 'INACTIVO';
  permisos: PermisosIntranet;
}

/** [correo, día 1-5, 'HH:mm', 'HH:mm', grupo] */
/** [email, día 1-5, desde, hasta, grupo (o GUARDIA / GUARDIA_RECREO), aula (opcional)] */
export type FilaHorario = [string, number, string, string, string, string?];

export function llamarApi(accion: string, datos: Record<string, unknown> = {}, timeoutMs = 45000): Promise<RespuestaApi> {
  return llamar(accion, { token: AuthService.getToken(), ...datos }, timeoutMs);
}

export const GRUPOS: string[] = LISTA_GRUPOS_OFICIALES.map((g) => g.codigo);

export function etiquetaGrupo(codigo: string): string {
  if (codigo === 'GUARDIA') return 'Guardia';
  if (codigo === 'GUARDIA_RECREO') return 'Guardia de recreo';
  return LISTA_GRUPOS_OFICIALES.find((g) => g.codigo === codigo)?.etiqueta || codigo || '—';
}

export function nombreCompleto(d: { nombre: string; apellidos: string }): string {
  return [d.apellidos, d.nombre].filter(Boolean).join(', ');
}
