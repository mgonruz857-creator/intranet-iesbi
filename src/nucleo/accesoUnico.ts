/**
 * Acceso único: con la sesión de convivencia abierta, su servidor firma un vale de un solo uso
 * (2 minutos) para otro módulo, cuyo servidor lo comprueba con la misma clave secreta.
 */
import { useEffect, useState } from 'react';
import { AuthService } from '../modulos/convivencia/services/authService';
import { llamarApi } from '../modulos/convivencia/services/apiService';
import { StorageService } from '../modulos/convivencia/services/storageService';
import type { Profesor } from '../modulos/convivencia/types/convivencia';
import { EVENTO_SESION_INTRANET, avisarCambioSesion } from './sesion';

export interface Vale { datos: string; firma: string }

export interface ResultadoVale {
  ok: boolean;
  vale?: Vale;
  /** El acceso único aún no está configurado en el servidor de convivencia */
  sinConfigurar?: boolean;
  mensaje?: string;
}

export async function pedirVale(destino: 'salidas' | 'guardias'): Promise<ResultadoVale> {
  const token = AuthService.getToken();
  if (!token) return { ok: false, sinConfigurar: false, mensaje: 'No hay sesión iniciada en la intranet.' };
  const r = await llamarApi('valeIntranet', { token, destino }, 45000);
  if (r.ok && r.vale) return { ok: true, vale: r.vale as Vale };
  // Servidor de convivencia aún sin actualizar o sin la clave secreta: el módulo pide su propio acceso
  const sinClave = r.codigo === 'SIN_ACCESO_UNICO';
  const servidorAntiguo = /desconocida/i.test(String(r.error || ''));
  return {
    ok: false,
    sinConfigurar: sinClave || servidorAntiguo,
    mensaje: sinClave
      ? 'Acceso único no activo: falta crear la clave en el servidor de convivencia (función crearSecretoIntranet).'
      : servidorAntiguo
        ? 'Acceso único no activo: el servidor de convivencia aún no tiene la versión nueva (falta "Nueva versión" en Gestionar implementaciones).'
        : String(r.error || 'No se ha podido obtener el acceso.'),
  };
}

export interface ResultadoEntradaUnica<U> {
  ok: boolean;
  token?: string;
  usuario?: U;
  /** El servidor de la intranet aún no lleva este módulo dentro: se usa su servidor propio (vale) */
  noDisponible?: boolean;
  codigo?: string;
  mensaje?: string;
}

/**
 * Servidor único: el módulo vive en el mismo servidor que la intranet y se entra con la misma sesión,
 * en una sola llamada. Si ese servidor aún no lo tiene (versión antigua o módulo sin instalar), se avisa
 * con noDisponible para que el módulo use su propio servidor como antes.
 */
export async function entrarServidorUnico<U>(modulo: 'salidas' | 'guardias'): Promise<ResultadoEntradaUnica<U>> {
  const token = AuthService.getToken();
  if (!token) return { ok: false, codigo: 'NO_AUTH', mensaje: 'No hay sesión iniciada en la intranet.' };
  const r = await llamarApi('entrarUnico', { modulo, token }, 45000);
  if (r.ok && r.token) return { ok: true, token: r.token as string, usuario: r.usuario as U };
  if (r.codigo === 'SIN_MODULO' || /desconocida/i.test(String(r.error || ''))) return { ok: false, noDisponible: true };
  return { ok: false, codigo: r.codigo, mensaje: String(r.mensaje || r.error || 'No se ha podido entrar.') };
}

/** Usuario con sesión en la intranet (null si no hay). Se comprueba también la inactividad. */
function usuarioActual(): Profesor | null {
  return AuthService.getToken() ? AuthService.getCurrentUser() : null;
}

export function useSesionIntranet(): Profesor | null {
  const [usuario, setUsuario] = useState<Profesor | null>(usuarioActual);
  useEffect(() => {
    const comprobar = () => setUsuario(usuarioActual());
    const actividad = () => AuthService.recordActivity();
    window.addEventListener(EVENTO_SESION_INTRANET, comprobar);
    window.addEventListener('storage', comprobar);
    ['click', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, actividad, { passive: true }));
    // getCurrentUser cierra la sesión si se ha superado el tiempo de inactividad
    const id = setInterval(comprobar, 15000);
    return () => {
      window.removeEventListener(EVENTO_SESION_INTRANET, comprobar);
      window.removeEventListener('storage', comprobar);
      ['click', 'keydown', 'touchstart'].forEach((ev) => window.removeEventListener(ev, actividad));
      clearInterval(id);
    };
  }, []);
  return usuario;
}

export interface PermisosIntranet {
  panel: boolean;
  convivencia: 'ADMIN' | 'DOCENTE';
  salidas: 'DOCENTE' | 'DIRECTIVO';
  guardias: 'DOCENTE' | 'JEFATURA';
}

const CLAVE_PERMISOS = 'intranet_permisos';

/** Permisos del docente en cada módulo, según el servidor central (null mientras llegan o si es un servidor antiguo). */
export function usePermisosIntranet(usuario: Profesor | null): PermisosIntranet | null {
  const email = usuario?.email || '';
  const [permisos, setPermisos] = useState<PermisosIntranet | null>(() => {
    try {
      const g = JSON.parse(sessionStorage.getItem(CLAVE_PERMISOS) || 'null');
      return g && g.email === email ? g.permisos : null;
    } catch { return null; }
  });
  useEffect(() => {
    if (!email) { setPermisos(null); return; }
    let vigente = true;
    llamarApi('perfilIntranet', { token: AuthService.getToken() }).then((r) => {
      if (!vigente || !r.ok || !r.permisos) return;
      setPermisos(r.permisos as PermisosIntranet);
      try { sessionStorage.setItem(CLAVE_PERMISOS, JSON.stringify({ email, permisos: r.permisos })); } catch { /* nada */ }
    });
    return () => { vigente = false; };
  }, [email]);
  return permisos;
}

export function cerrarSesionIntranet() {
  AuthService.logout('MANUAL'); // avisa a la intranet y borra las sesiones de los demás módulos
  StorageService.clearMemoryCacheForFreshLogin();
}

export { avisarCambioSesion };
