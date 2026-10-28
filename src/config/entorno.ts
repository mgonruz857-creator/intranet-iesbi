/**
 * Entorno de toda la intranet: 'PRUEBAS' o 'PRODUCCION'.
 *
 * Es el único sitio donde se elige. Cada módulo lee de aquí y guarda en su propio
 * src/modulos/<módulo>/config/entorno.ts las direcciones de su servidor en cada entorno.
 *
 * Esta copia (mgonruz857-creator/intranet-iesbi) trabaja SIEMPRE en PRUEBAS.
 * PRODUCCION solo se usará cuando la intranet pase al centro (intranetiesbi.github.io)
 * y Miguel Ángel lo diga.
 */

export type Entorno = 'PRUEBAS' | 'PRODUCCION';

export const ENTORNO: Entorno = 'PRUEBAS' as Entorno; // 'PRUEBAS' o 'PRODUCCION'

export const ES_ENTORNO_PRUEBAS: boolean = ENTORNO === 'PRUEBAS';
