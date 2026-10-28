/**
 * Configuración del entorno de datos.
 *
 * Esta copia de la app trabaja contra una base de datos de PRUEBAS
 * (carpeta SIGC_PRUEBAS en el Drive de mgonruz857@g.educaand.es),
 * con alumnado ficticio. Así no se tocan los datos reales del centro.
 *
 * Todo lo que identifica dónde se guardan los datos (programa de Apps Script,
 * cuenta, carpeta y nombre del archivo) está aquí y en ningún otro sitio.
 * El entorno (PRUEBAS / PRODUCCION) se elige en src/config/entorno.ts, para toda la intranet.
 */

// El entorno se elige para toda la intranet en src/config/entorno.ts
import { ENTORNO, type Entorno } from '../../../config/entorno';

interface ConfigDrive {
  urlApi: string;
  cuenta: string;
  carpetaId: string;
  nombreCarpeta: string;
  archivoDb: string;
  nombreUnidad: string;
  urlApp: string;
}

const CONFIG: Record<Entorno, ConfigDrive> = {
  PRUEBAS: {
    urlApi:
      'https://script.google.com/macros/s/AKfycbxWamqKMoaoRgrflhIj6ocgiHN4uRcCXg6NdiMJEo7WXI0a6dSiuuDbbOy9AubyiuS7/exec',
    cuenta: 'mgonruz857@g.educaand.es',
    carpetaId: '1OeH-dt7zuEeuX-5MLEZ9x2gn24eoGplG',
    nombreCarpeta: 'SIGC_PRUEBAS',
    archivoDb: '00_SIGC_BD_PRUEBAS.json',
    nombreUnidad: 'Entorno de PRUEBAS (datos ficticios)',
    urlApp: 'https://mgonruz857-creator.github.io/intranet-iesbi/#/convivencia',
  },
  PRODUCCION: {
    urlApi:
      'https://script.google.com/macros/s/AKfycbyrmV69dBgcg9WD0mx4tQLWeZtbqSR7odMS87HS5VyOPQL90RNNZMkpp5HHGZ30HimLNQ/exec',
    cuenta: '14007180.aplicaciones@g.educaand.es',
    carpetaId: '1S5zjeSgcfVkL-eoQLsJ9I_ltHAnRrbaS',
    nombreCarpeta: 'CONVIVENCIA_IES_BLAS_INFANTE',
    archivoDb: '00_SIGC_BD_CENTRO_BLAS_INFANTE.json',
    nombreUnidad: 'Unidad Compartida Convivencia - IES Blas Infante',
    // Sigue siendo la app del centro hasta que la intranet la sustituya
    urlApp: 'https://convivenciaiesbi.github.io/',
  },
};

const ACTUAL = CONFIG[ENTORNO];

export const ES_ENTORNO_PRUEBAS: boolean = ENTORNO === 'PRUEBAS';
/** En desarrollo local se puede apuntar a otro servidor con VITE_URL_API_CONVIVENCIA (el simulador). */
export const URL_API_DRIVE: string = import.meta.env?.VITE_URL_API_CONVIVENCIA || ACTUAL.urlApi;
export const CUENTA_DRIVE: string = ACTUAL.cuenta;
export const CARPETA_DRIVE_ID: string = ACTUAL.carpetaId;
export const NOMBRE_CARPETA_DRIVE: string = ACTUAL.nombreCarpeta;
export const ARCHIVO_DB_DRIVE: string = ACTUAL.archivoDb;
export const NOMBRE_UNIDAD_DRIVE: string = ACTUAL.nombreUnidad;
/** Dirección de la app (para el enlace de los correos). */
export const URL_APP: string = ACTUAL.urlApp;
/** Prefijo para copias de seguridad descargadas (sin la extensión .json). */
export const PREFIJO_BACKUP: string = ARCHIVO_DB_DRIVE.replace(/\.json$/, '');
