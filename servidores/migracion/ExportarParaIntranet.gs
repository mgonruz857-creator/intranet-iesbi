/**
 * PASO A LA INTRANET (28/11/2026) · archivo TEMPORAL para el proyecto de la app de convivencia antigua
 * (API_Convivencia_BlasInfante, cuenta del centro).
 *
 * Se añade como archivo nuevo, se ejecuta UNA vez la función intranetExportar desde el editor y se BORRA.
 * No hace falta "Implementar": la app antigua sigue funcionando con su versión publicada, que no cambia.
 *
 * Qué hace (solo LEE en la app antigua; no cambia su archivo de datos ni sus propiedades):
 *  1) Hace una copia exacta del archivo de datos en la carpeta proyectoIntranet/PRODUCCION
 *     con el nombre 00_SIGC_BD_INTRANET.json.
 *  2) Deja en esa misma carpeta un archivo de paso (MIGRACION_DESDE_CONVIVENCIA.json) con las contraseñas
 *     cifradas del profesorado y los recuentos del original. La intranet lo lee con importarDesdeConvivencia
 *     y lo manda a la papelera.
 * No escribe en el registro ningún dato personal ni ninguna contraseña.
 */
function intranetExportar() {
  var ORIGEN_CARPETA = '1S5zjeSgcfVkL-eoQLsJ9I_ltHAnRrbaS';       // CONVIVENCIA_IES_BLAS_INFANTE
  var ORIGEN_ARCHIVO = '00_SIGC_BD_CENTRO_BLAS_INFANTE.json';
  var DESTINO_CARPETA = '1sEI0H7cAwRViVDwtGuQfVdaqsqFPSUcv';      // proyectoIntranet/PRODUCCION
  var DESTINO_ARCHIVO = '00_SIGC_BD_INTRANET.json';
  var PASO = 'MIGRACION_DESDE_CONVIVENCIA.json';

  var destino = DriveApp.getFolderById(DESTINO_CARPETA);
  if (destino.getFilesByName(DESTINO_ARCHIVO).hasNext()) {
    Logger.log('PARADO: ya hay un ' + DESTINO_ARCHIVO + ' en proyectoIntranet/PRODUCCION. No se ha hecho nada. Avise antes de seguir.');
    return;
  }
  // Mientras se copia, nadie puede guardar en la app antigua (usa este mismo cerrojo)
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var it = DriveApp.getFolderById(ORIGEN_CARPETA).getFilesByName(ORIGEN_ARCHIVO);
    var lista = [];
    while (it.hasNext()) lista.push(it.next());
    if (lista.length !== 1) {
      Logger.log('PARADO: hay ' + lista.length + ' archivos llamados ' + ORIGEN_ARCHIVO + ' (tiene que haber exactamente 1). No se ha hecho nada.');
      return;
    }
    var original = lista[0];
    var bytes = original.getBlob().getBytes();
    var db = JSON.parse(original.getBlob().getDataAsString());

    var recuento = {};
    for (var k in db) {
      if (Object.prototype.toString.call(db[k]) === '[object Array]') recuento[k] = db[k].length;
      else if (db[k] && typeof db[k] === 'object') recuento[k] = Object.keys(db[k]).length;
    }
    var sha = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
      .map(function (b) { var h = (b & 255).toString(16); return h.length === 1 ? '0' + h : h; }).join('');

    var todas = PropertiesService.getScriptProperties().getProperties();
    var propiedades = {};
    var nClaves = 0;
    for (var p in todas) {
      if (p.indexOf('CLAVE_') === 0) { propiedades[p] = todas[p]; nClaves++; }
      if (p === 'SECRETO_SERVIDOR') propiedades[p] = todas[p];
    }

    original.makeCopy(DESTINO_ARCHIVO, destino);
    destino.createFile(PASO, JSON.stringify({ fecha: new Date().toISOString(), sha256: sha, recuento: recuento,
      propiedades: propiedades }), MimeType.PLAIN_TEXT);

    Logger.log('HECHO. Copia del archivo de datos en proyectoIntranet/PRODUCCION como ' + DESTINO_ARCHIVO + '.');
    Logger.log('Contraseñas guardadas en este servidor: ' + nClaves + (propiedades.SECRETO_SERVIDOR ? ' (con su clave de cifrado).' : '.'));
    Logger.log('Contraseñas dentro del archivo de datos: ' + Object.keys(db.credenciales_profesores || {}).length + '.');
    Object.keys(recuento).sort().forEach(function (k) { Logger.log('   ' + k + ': ' + recuento[k]); });
    Logger.log('Ahora borre este archivo (ExportarParaIntranet) del proyecto. No hace falta implementar nada.');
  } finally {
    lock.releaseLock();
  }
}
