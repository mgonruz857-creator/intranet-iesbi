/**
 * Entorno de toda la intranet: 'PRUEBAS' o 'PRODUCCION'.
 *
 * Es el único sitio donde se elige. Cada módulo lee de aquí y guarda en su propio
 * src/modulos/<módulo>/config/entorno.ts las direcciones de su servidor en cada entorno.
 *
 * mgonruz857-creator/intranet-iesbi trabaja SIEMPRE en PRUEBAS. La intranet del centro
 * (intranetiesbi.github.io, desde el 28/11/2026) es el mismo código compilado en PRODUCCION.
 */

export type Entorno = 'PRUEBAS' | 'PRODUCCION';

/**
 * El mismo código se publica en dos sitios:
 *  - mgonruz857-creator/intranet-iesbi → PRUEBAS (siempre, es lo que se compila si no se dice nada)
 *  - intranetiesbi/intranetiesbi.github.io → PRODUCCION: su publicación (.github/workflows/deploy.yml)
 *    compila con VITE_ENTORNO=PRODUCCION. Para generar el servidor de producción:
 *    VITE_ENTORNO=PRODUCCION npx tsx servidores/unico/generar.mts <carpeta>
 */
const elegido: unknown =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ENTORNO ??
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.VITE_ENTORNO;

export const ENTORNO: Entorno = elegido === 'PRODUCCION' ? 'PRODUCCION' : 'PRUEBAS';

export const ES_ENTORNO_PRUEBAS: boolean = ENTORNO === 'PRUEBAS';
