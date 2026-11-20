/**
 * Servidor único simulado (Intranet.gs + Salidas.gs + Guardias.gs en un mismo proyecto), con las hojas de
 * los módulos y Drive en memoria. Solo datos ficticios. Lo usan la prueba servidor_unico y el servidor local.
 */
const { crearServidor } = await import('../convivencia/simulador.mts');
const { Hoja, formatear } = await import('../salidas/simulador.mjs');
const { generarServidorUnico } = await import('../../servidores/unico/generar.mts');

export function crearServidorUnico(db: any) {
  const archivos = generarServidorUnico();
  // Hojas de cálculo de los módulos (se abren por su identificador) y Drive para las tareas de guardias
  const libros: Record<string, any> = {};
  const crearLibro = (id: string) => {
    const hojas: Record<string, any> = {};
    libros[id] = {
      hojas, getId: () => id, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id,
      getSheetByName: (n: string) => hojas[n] || null, insertSheet: (n: string) => (hojas[n] = new Hoja(n)),
      setSpreadsheetTimeZone() {}, getSpreadsheetTimeZone: () => 'Europe/Madrid',
    };
  };
  crearLibro('hoja-salidas'); crearLibro('hoja-guardias');
  const red: any[] = [];
  const archivosModulos: Record<string, any> = {};
  let n = 0;
  const carpeta = (id: string): any => ({
    getId: () => id, createFolder: () => carpeta('carpeta-' + (++n)), getFoldersByName: () => ({ hasNext: () => false }),
    createFile: (blob: any) => { const fid = 'archivo-' + (++n); archivosModulos[fid] = blob; return { getId: () => fid }; },
  });

  const srv = crearServidor(Object.values(archivos).join('\n'), db, {
    extra: (ctx: any) => {
      const drive = ctx.DriveApp, formato = ctx.Utilities.formatDate;
      return {
        SpreadsheetApp: { openById: (id: string) => { if (!libros[id]) throw new Error('No existe la hoja ' + id); return libros[id]; },
          getActive: () => null, flush() {} },
        DriveApp: {
          getFileById: (id: string) => id.startsWith('hoja-') ? { getParents: () => { let u = false; return { hasNext: () => !u, next: () => { u = true; return carpeta('raiz'); } }; } }
            : id.startsWith('archivo-') ? { getBlob: () => archivosModulos[id] } : drive.getFileById(id),
          getFolderById: (id: string) => id.startsWith('carpeta-') ? carpeta(id) : drive.getFolderById(id),
          getRootFolder: () => carpeta('raiz'),
        },
        UrlFetchApp: { fetch: (url: string) => { red.push(url); throw new Error('Sin red en el servidor único'); } },
        Utilities: { ...ctx.Utilities,
          formatDate: (d: Date, z: string, f: string) => (f === 'Z' || f.includes('_') ? formato(d, z, f) : formatear(d, z, f)),
          base64Decode: (t: string) => [...Buffer.from(t, 'base64')],
          newBlob: (bytes: number[], tipo: string, nombre: string) => ({ getBytes: () => bytes, getContentType: () => tipo, getName: () => nombre }),
        },
      };
    },
  });
  return { srv, libros, red, archivos };
}
