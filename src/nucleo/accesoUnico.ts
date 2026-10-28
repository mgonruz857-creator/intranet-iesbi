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
  const sinConfigurar = r.codigo === 'SIN_ACCESO_UNICO' || /desconocida/i.test(String(r.error || ''));
  return { ok: false, sinConfigurar, mensaje: String(r.error || 'No se ha podido obtener el acceso.') };
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

export function cerrarSesionIntranet() {
  AuthService.logout('MANUAL'); // avisa a la intranet y borra las sesiones de los demás módulos
  StorageService.clearMemoryCacheForFreshLogin();
}

export { avisarCambioSesion };
