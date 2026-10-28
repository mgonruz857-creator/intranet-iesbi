/**
 * Sesión de la intranet.
 *
 * Quien identifica al profesorado es el servidor de convivencia: su inicio de sesión es el de toda
 * la intranet. Los demás módulos abren su propia sesión con un vale firmado (ver accesoUnico.ts).
 * Este archivo no importa nada de los módulos para que convivencia pueda avisar sin dependencias circulares.
 */

export const EVENTO_SESION_INTRANET = 'intranet-sesion';

/** Sesiones que guardan en el navegador los demás módulos (se borran al cerrar la de la intranet). */
const CLAVES_MODULOS = ['gbcs_token', 'gbcs_usuario', 'gbcs_acceso_unico'];

/** Lo llama convivencia al cerrar su sesión (a mano, por inactividad o porque el servidor la invalida). */
export function alCerrarSesionConvivencia() {
  try { CLAVES_MODULOS.forEach((k) => sessionStorage.removeItem(k)); } catch { /* sin almacenamiento */ }
  avisarCambioSesion();
}

export function avisarCambioSesion() {
  window.dispatchEvent(new Event(EVENTO_SESION_INTRANET));
}
