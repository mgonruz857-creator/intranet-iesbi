/**
 * Servidor de guardias (Apps Script dentro de su hoja de cálculo).
 * PRUEBAS: hoja en la carpeta proyectoIntranet/PRUEBAS del Drive de Miguel Ángel.
 * PRODUCCION: cuenta del centro (cuando se pase la intranet).
 */
import { ENTORNO, type Entorno } from '../../../config/entorno';

const CONFIG: Record<Entorno, { urlApi: string }> = {
  PRUEBAS: { urlApi: '' }, // pegar aquí la URL /exec del servidor de guardias de pruebas
  PRODUCCION: { urlApi: '' },
};

export const ES_ENTORNO_PRUEBAS = ENTORNO === 'PRUEBAS';
/** En desarrollo local se puede apuntar al simulador con VITE_URL_API_GUARDIAS. */
export const URL_API: string = import.meta.env.VITE_URL_API_GUARDIAS || CONFIG[ENTORNO].urlApi;
