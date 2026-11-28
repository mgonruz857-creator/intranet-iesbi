/**
 * Guardias · Intranet IES Blas Infante (Córdoba)
 * Servidor Google Apps Script (va dentro de una hoja de cálculo: Extensiones > Apps Script).
 *
 * Publicación: Implementar > Nueva implementación > Aplicación web
 *   - Ejecutar como: Yo (la cuenta propietaria de la hoja)
 *   - Quién tiene acceso: Cualquier persona
 *     (la seguridad la pone este programa: solo se entra con el acceso único de la intranet)
 *
 * Propiedades del script (Configuración del proyecto > Propiedades de secuencia de comandos):
 *   SECRETO_INTRANET      la misma clave que el servidor central (acceso único y lectura de datos)
 *   URL_SERVIDOR_CENTRAL  dirección /exec del servidor central (convivencia)
 *
 * El profesorado, sus permisos (DOCENTE / JEFATURA) y los horarios (con las horas de guardia) se leen del
 * servidor central (acción datosCentro). Esta hoja solo guarda las ausencias y las guardias:
 *   Ausencias  A id | B fecha | C email | D motivo | E registrada_por | F creada | G estado (ACTIVA | ANULADA)
 *   Guardias   A id | B id_ausencia | C fecha | D desde | E hasta | F grupo | G aula | H tarea | I archivo_id |
 *              J archivo_nombre | K asignada_a | L estado (PENDIENTE | HECHA | ANULADA) | M incidencias |
 *              N cerrada_por | O actualizada
 * Las tareas en archivo se guardan en la carpeta "Tareas_Guardias", junto a la hoja.
 *
 * Reparto: cada hora de ausencia se asigna al docente de guardia de esa hora (según su horario) con menos
 * guardias en el curso (desde el 1 de septiembre); si no hay nadie libre, queda "sin cubrir".
 * Grupos conflictivos (desde la versión 1.4.0: todo FP y FP Básica, 3º ESO A, 3º ESO C y 4º ESO A): se rota
 * quién va, eligiendo al que menos guardias en conflictivos lleva (sin pasarse de 2 guardias por encima del que
 * menos lleva en total); en los demás grupos va el que menos guardias lleva y, si empatan, el que más
 * conflictivos ha cubierto. Ver elegirDocente_.
 * El motivo de la ausencia solo lo ven el propio docente y quien tiene permiso JEFATURA.
 *
 * Funciones para ejecutar desde el editor: configurarHoja, probarServidorCentral, limpiarCache.
 *
 * Servidor único de la intranet (desde la versión 1.2.0): este mismo código puede ir como archivo
 * Guardias.gs dentro del proyecto del servidor central (lo prepara scripts/generarServidorUnico.mts).
 * Entonces la sesión es la de la intranet, los datos del centro se leen sin pasar por la red y la hoja
 * se abre con la propiedad ID_HOJA_GUARDIAS. Ver docs/servidor-unico.md.
 */

// ───────────────────────── Configuración ─────────────────────────

var VERSION = '1.5.0';
var ZONA = 'Europe/Madrid';
var DOMINIO = '@g.educaand.es';
var DURACION_SESION_SEG = 21600;    // 6 horas (máximo de CacheService), se renueva con el uso
var CACHE_CENTRAL_SEG = 600;        // datos del servidor central: se vuelven a pedir cada 10 minutos
var ESPERA_CERROJO_MS = 15000;
var MAX_ARCHIVO_BYTES = 8 * 1024 * 1024;
var CARPETA_TAREAS = 'Tareas_Guardias';

// Grupos conflictivos (normas del centro, 27/11/2026): todo FP y FP Básica, 3º ESO A, 3º ESO C y 4º ESO A.
var GRUPOS_CONFLICTIVOS = ['3ESO_A', '3ESO_C', '4ESO_A'];
var TOLERANCIA_TOTAL = 2; // para un conflictivo no se elige a quien lleve más de 2 guardias por encima del que menos lleva

var HOJA_AUSENCIAS = 'Ausencias';
var HOJA_GUARDIAS = 'Guardias';
var CABECERAS = {
  Ausencias: ['id', 'fecha', 'email', 'motivo', 'registrada_por', 'creada', 'estado'],
  Guardias: ['id', 'id_ausencia', 'fecha', 'desde', 'hasta', 'grupo', 'aula', 'tarea', 'archivo_id', 'archivo_nombre',
    'asignada_a', 'estado', 'incidencias', 'cerrada_por', 'actualizada']
};
var A = { id: 0, fecha: 1, email: 2, motivo: 3, por: 4, creada: 5, estado: 6 };
var G = { id: 0, ausencia: 1, fecha: 2, desde: 3, hasta: 4, grupo: 5, aula: 6, tarea: 7, archivoId: 8, archivoNombre: 9,
  asignada: 10, estado: 11, incidencias: 12, cerradaPor: 13, actualizada: 14 };

var MENSAJES = {
  'NO_AUTH': 'La sesión ha caducado. Vuelva a entrar desde la intranet.',
  '401_UNAUTHORIZED': 'Su cuenta no está en el profesorado activo del centro.',
  'SIN_ACCESO_UNICO': 'El acceso único de la intranet no está configurado en el servidor de guardias.',
  'VALE_NO_VALIDO': 'No se ha podido comprobar su sesión de la intranet. Vuelva a iniciar sesión.',
  'ERROR_CENTRAL': 'No se han podido leer los datos del centro (servidor central de la intranet). Inténtelo de nuevo en unos minutos.',
  'ERROR_PETICION': 'Petición no válida.',
  'ERROR_SIN_PERMISO': 'Esto solo lo puede hacer Jefatura de Estudios o Dirección.',
  'ERROR_NO_ENCONTRADA': 'No se encuentra (puede que se haya anulado).',
  'ERROR_FECHA': 'La fecha no es válida (debe ser un día lectivo de lunes a viernes).',
  'ERROR_SIN_HORAS': 'Marque al menos una hora.',
  'ERROR_ARCHIVO': 'El archivo de la tarea no es válido o supera los 8 MB.',
  'ERROR_YA_AUSENTE': 'Ya hay una ausencia registrada para alguna de esas horas.',
  'ERROR_NO_ES_DE_GUARDIA': 'Solo puede coger una guardia el docente que está de guardia a esa hora.',
  'ERROR_YA_ASIGNADA': 'Esa guardia ya está asignada.',
  'ERROR_YA_TIENE_GUARDIA': 'Ya tiene otra guardia a esa hora.',
  'ERROR_YA_HECHA': 'Esa guardia ya está hecha: no se puede quitar.',
  'ERROR_PASADA': 'Solo Jefatura o Dirección pueden cambiar una ausencia de un día ya pasado.',
  'ERROR_OCUPADO': 'El sistema está atendiendo otras peticiones. Inténtelo de nuevo en unos segundos.',
  'ERROR_ACCION': 'Acción desconocida.',
  'ERROR_CONFIG': 'El servidor no está configurado del todo.'
};

// ───────────────────────── Entrada web ─────────────────────────

function doGet() {
  return salida_({ ok: true, servicio: 'Guardias', version: VERSION });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return salida_(fallo_('ERROR_PETICION'));
  }
  return salida_(atender_(req, ahoraServidor_()));
}

function atender_(req, ahora, emailUnico) {
  try {
    var u;
    if (emailUnico !== undefined) {
      // Servidor único: el servidor central ya ha comprobado la sesión de la intranet
      u = profesorado_()[norm_(emailUnico)];
      if (!u) error_('401_UNAUTHORIZED');
      if (req.accion === 'entrarUnico') return { ok: true, token: req.token, usuario: perfilPublico_(u) };
    } else {
      switch (req.accion) {
        case 'entrarConVale': return entrarConVale_(req);
        case 'logout': cerrarSesion_(req.token); return { ok: true };
      }
      u = sesion_(req.token);
    }
    switch (req.accion) {
      case 'inicio': return { ok: true, usuario: perfilPublico_(u), hoy: fechaTexto_(ahora), version: VERSION };
      case 'misClases': return misClases_(u, req);
      case 'miHorario': return miHorario_(u, req);
      case 'registrarAusencia': return conCerrojo_(function () { return registrarAusencia_(u, req, ahora); });
      case 'anularAusencia': return conCerrojo_(function () { return anularAusencia_(u, req, ahora); });
      case 'misAusencias': return misAusencias_(u, req, ahora);
      case 'quitarHora': return conCerrojo_(function () { return quitarHora_(u, req, ahora); });
      case 'misGuardias': return misGuardias_(u, req, ahora);
      case 'dia': return dia_(u, req, ahora);
      case 'marcarHecha': return conCerrojo_(function () { return marcarHecha_(u, req, ahora); });
      case 'asignar': return conCerrojo_(function () { return asignar_(u, req, ahora); });
      case 'coger': return conCerrojo_(function () { return coger_(u, req, ahora); });
      case 'descargarTarea': return descargarTarea_(u, req);
      case 'recuento': return recuento_(u, ahora);
      case 'profesorado': return listaProfesorado_(u);
      case 'relojPruebas': return relojPruebas_(req);
      default: return fallo_('ERROR_ACCION');
    }
  } catch (err) {
    if (err && err.codigo) return fallo_(err.codigo, err.message);
    console.error(err && err.stack || err);
    return { ok: false, codigo: 'ERROR_INTERNO', mensaje: 'Error inesperado del servidor: ' + (err && err.message || err) };
  }
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function error_(codigo, mensaje) {
  var e = new Error(mensaje || MENSAJES[codigo] || codigo);
  e.codigo = codigo;
  throw e;
}

function fallo_(codigo, mensaje) {
  return { ok: false, codigo: codigo, mensaje: mensaje || MENSAJES[codigo] || codigo };
}

function norm_(email) { return String(email || '').trim().toLowerCase(); }

// ───────────────────────── Sesión (acceso único) ─────────────────────────

/** Vale firmado por el servidor central (convivencia) con SECRETO_INTRANET, de un solo uso y 2 minutos. */
function entrarConVale_(req) {
  var secreto = PropertiesService.getScriptProperties().getProperty('SECRETO_INTRANET');
  if (!secreto) error_('SIN_ACCESO_UNICO');
  var vale = req.vale || {};
  var datos = String(vale.datos || '');
  var firma = Utilities.base64Encode(Utilities.computeHmacSha256Signature(datos, secreto));
  if (!datos || firma !== vale.firma) error_('VALE_NO_VALIDO');
  var d = JSON.parse(datos);
  if (d.destino !== 'guardias' || !(d.exp > new Date().getTime()) || !d.n) error_('VALE_NO_VALIDO');
  var cache = CacheService.getScriptCache();
  if (cache.get('VALE_' + d.n)) error_('VALE_NO_VALIDO');
  cache.put('VALE_' + d.n, '1', 600);
  var p = profesorado_()[norm_(d.email)];
  if (!p) error_('401_UNAUTHORIZED');
  var token = Utilities.getUuid() + Utilities.getUuid();
  cache.put('SES_' + token, p.email, DURACION_SESION_SEG);
  return { ok: true, token: token, usuario: perfilPublico_(p) };
}

function sesion_(token) {
  if (!token) error_('NO_AUTH');
  var cache = CacheService.getScriptCache();
  var email = cache.get('SES_' + token);
  if (!email) error_('NO_AUTH');
  var p = profesorado_()[email];
  if (!p) { cerrarSesion_(token); error_('NO_AUTH', 'Su cuenta ya no tiene acceso.'); }
  cache.put('SES_' + token, email, DURACION_SESION_SEG);
  return p;
}

function cerrarSesion_(token) {
  if (token) CacheService.getScriptCache().remove('SES_' + token);
}

function perfilPublico_(p) { return { email: p.email, nombre: p.nombre, jefatura: p.jefatura }; }

function exigirJefatura_(u) { if (!u.jefatura) error_('ERROR_SIN_PERMISO'); }

// ───────────────────────── Datos del servidor central ─────────────────────────

/** true si este código va dentro del servidor central (servidor único de la intranet). */
function servidorUnico_() { return typeof datosCentroInterno === 'function'; }

function urlCentral_() {
  return String(PropertiesService.getScriptProperties().getProperty('URL_SERVIDOR_CENTRAL') || '').trim();
}

/** { profesorado: {email: {email, nombre, jefatura}}, horario: {email: [[dia, desde, hasta, grupo, aula]]} } */
function central_() {
  var cache = CacheService.getScriptCache();
  var n = cache.get('GUA_CENTRAL_N');
  if (n) {
    var claves = [];
    for (var i = 0; i < Number(n); i++) claves.push('GUA_CENTRAL_' + i);
    var trozos = cache.getAll(claves);
    if (claves.every(function (k) { return trozos[k] !== undefined && trozos[k] !== null; })) {
      return JSON.parse(claves.map(function (k) { return trozos[k]; }).join(''));
    }
  }
  var valor = pedirCentral_();
  var texto = JSON.stringify(valor);
  var pares = {};
  var total = Math.ceil(texto.length / 90000) || 1;
  for (var j = 0; j < total; j++) pares['GUA_CENTRAL_' + j] = texto.slice(j * 90000, (j + 1) * 90000);
  pares['GUA_CENTRAL_N'] = String(total);
  cache.putAll(pares, CACHE_CENTRAL_SEG);
  return valor;
}

function pedirCentral_() {
  if (servidorUnico_()) return convertirCentral_(datosCentroInterno('guardias'));
  var url = urlCentral_();
  if (!url) error_('ERROR_CENTRAL', 'Falta la propiedad URL_SERVIDOR_CENTRAL en el servidor de guardias.');
  var secreto = PropertiesService.getScriptProperties().getProperty('SECRETO_INTRANET');
  if (!secreto) error_('ERROR_CENTRAL', 'Falta la propiedad SECRETO_INTRANET en el servidor de guardias.');
  var datos = JSON.stringify({ modulo: 'guardias', exp: new Date().getTime() + 120000, n: Utilities.getUuid() });
  var firma = Utilities.base64Encode(Utilities.computeHmacSha256Signature(datos, secreto));
  var r;
  try {
    var resp = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({ accion: 'datosCentro', peticion: { datos: datos, firma: firma } })
    });
    r = JSON.parse(resp.getContentText());
  } catch (err) {
    console.error(err && err.stack || err);
    error_('ERROR_CENTRAL');
  }
  if (!r || !r.ok) error_('ERROR_CENTRAL', MENSAJES.ERROR_CENTRAL + ' Respuesta: ' + ((r && (r.error || r.mensaje)) || 'vacía'));
  return convertirCentral_(r);
}

/** Pasa los datos del centro al formato que usa este servidor. */
function convertirCentral_(r) {
  var profesorado = {}, horario = {};
  (r.profesores || []).forEach(function (p) {
    var email = norm_(p.email);
    if (!email) return;
    var nombre = [p.apellidos, p.nombre].filter(function (x) { return x; }).join(', ');
    profesorado[email] = { email: email, nombre: nombre || email, jefatura: p.permiso === 'JEFATURA', sustituyeA: p.sustituye_a || '' };
  });
  (r.horarios || []).forEach(function (f) {
    var e = norm_(f[0]), dia = Number(f[1]), desde = minutos_(f[2]), hasta = minutos_(f[3]), grupo = String(f[4] || '').trim();
    if (!e || !(dia >= 1 && dia <= 5) || desde === null || hasta === null || !grupo) return;
    (horario[e] = horario[e] || []).push([dia, desde, hasta, grupo, String(f[5] || '')]);
  });
  return { profesorado: profesorado, horario: horario };
}

function profesorado_() { return central_().profesorado; }

function limpiarCache() {
  CacheService.getScriptCache().removeAll(['GUA_CENTRAL_N']);
}

/** Ejecutar desde el editor: comprueba la conexión (y pide el permiso de Google la primera vez). */
function probarServidorCentral() {
  limpiarCache();
  var d = central_();
  var guardias = 0;
  Object.keys(d.horario).forEach(function (e) {
    d.horario[e].forEach(function (t) { if (/^GUARDIA/.test(t[3])) guardias++; });
  });
  Logger.log('Conexión correcta. Profesorado: ' + Object.keys(d.profesorado).length + ' · Horas de guardia en el horario: ' + guardias);
}

// ───────────────────────── Ausencias ─────────────────────────

/** Clases (no guardias) del docente el día indicado, para elegir las horas de la ausencia. */
function misClases_(u, req) {
  var email = u.email;
  if (req.email && norm_(req.email) !== u.email) { exigirJefatura_(u); email = norm_(req.email); }
  if (!profesorado_()[email]) return fallo_('401_UNAUTHORIZED');
  var fecha = validarFecha_(req.fecha);
  var dia = diaSemana_(fecha);
  var clases = (central_().horario[email] || []).filter(function (t) { return t[0] === dia && !/^GUARDIA/.test(t[3]); })
    .map(function (t) { return { desde: texto_(t[1]), hasta: texto_(t[2]), grupo: t[3], aula: t[4] }; });
  clases.sort(function (a, b) { return a.desde.localeCompare(b.desde); });
  return { ok: true, fecha: fecha, clases: clases, comunicadas: horasComunicadas_(email, fecha) };
}

/** Horas de ausencia ya comunicadas por un docente un día (para modificar la ausencia: añadir o quitar horas). */
function horasComunicadas_(email, fecha) {
  var activas = {};
  filas_(HOJA_AUSENCIAS).forEach(function (a) { if (a[A.estado] === 'ACTIVA' && a[A.email] === email && a[A.fecha] === fecha) activas[a[A.id]] = true; });
  var r = filas_(HOJA_GUARDIAS).filter(function (g) { return activas[g[G.ausencia]] && g[G.estado] !== 'ANULADA'; })
    .map(function (g) {
      return { id: g[G.id], idAusencia: g[G.ausencia], desde: comoHora_(g[G.desde]), hasta: comoHora_(g[G.hasta]),
        grupo: g[G.grupo], tarea: g[G.tarea], archivo: g[G.archivoNombre] || '', hecha: g[G.estado] === 'HECHA' };
    });
  r.sort(function (a, b) { return a.desde.localeCompare(b.desde); });
  return r;
}

/**
 * horas = [{desde, hasta, grupo, aula, tarea, archivo?: {nombre, tipo, base64}}]
 * Jefatura puede registrarla por otro docente (email).
 */
/** Horario semanal del docente (con las horas prestadas si es sustituto). Jefatura puede ver el de cualquiera. */
function miHorario_(u, req) {
  var email = u.email;
  if (req.email && norm_(req.email) !== u.email) { exigirJefatura_(u); email = norm_(req.email); }
  var horas = (central_().horario[email] || []).map(function (t) {
    return { dia: t[0], desde: texto_(t[1]), hasta: texto_(t[2]), grupo: t[3], aula: t[4] };
  });
  horas.sort(function (a, b) { return a.dia - b.dia || a.desde.localeCompare(b.desde); });
  var p = profesorado_()[email];
  return { ok: true, email: email, horas: horas, sustituyeA: (p && p.sustituyeA) || '' };
}

function registrarAusencia_(u, req, ahora) {
  var email = u.email;
  if (req.email && norm_(req.email) !== u.email) { exigirJefatura_(u); email = norm_(req.email); }
  if (!profesorado_()[email]) return fallo_('401_UNAUTHORIZED');
  var fecha = validarFecha_(req.fecha);
  var horas = (Array.isArray(req.horas) ? req.horas : []).slice(0, 12).map(function (h) {
    var desde = minutos_(h && h.desde), hasta = minutos_(h && h.hasta);
    if (desde === null || hasta === null || hasta <= desde) error_('ERROR_PETICION', 'Hay una hora no válida.');
    return { desde: desde, hasta: hasta, grupo: limpiar_(h.grupo, 20), aula: limpiar_(h.aula, 30),
      tarea: String(h.tarea || '').trim().slice(0, 4000), archivo: h.archivo || null };
  });
  if (!horas.length) return fallo_('ERROR_SIN_HORAS');

  var guardias = filas_(HOJA_GUARDIAS);
  var ausencias = filas_(HOJA_AUSENCIAS);
  var activasDe = {};
  ausencias.forEach(function (a) { if (a[A.estado] === 'ACTIVA') activasDe[a[A.id]] = a[A.email]; });
  var yaAusente = guardias.some(function (g) {
    return g[G.estado] !== 'ANULADA' && g[G.fecha] === fecha && activasDe[g[G.ausencia]] === email &&
      horas.some(function (h) { return solapa_(h.desde, h.hasta, minutos_(g[G.desde]), minutos_(g[G.hasta])); });
  });
  if (yaAusente) return fallo_('ERROR_YA_AUSENTE');

  var sello = ahora.toISOString();
  var idAus;
  if (req.ausencia) {
    // Añadir horas a una ausencia ya comunicada (mismo docente y mismo día)
    var ia = indice_(ausencias, A.id, req.ausencia);
    if (ia < 0 || ausencias[ia][A.estado] !== 'ACTIVA' || ausencias[ia][A.email] !== email || ausencias[ia][A.fecha] !== fecha) return fallo_('ERROR_NO_ENCONTRADA');
    if (fecha < fechaTexto_(ahora) && !u.jefatura) return fallo_('ERROR_PASADA');
    idAus = req.ausencia;
  } else {
    idAus = 'aus_' + Utilities.getUuid().slice(0, 12);
    anadirFilas_(HOJA_AUSENCIAS, [[idAus, fecha, email, String(req.motivo || '').trim().slice(0, 500), u.email, sello, 'ACTIVA']]);
  }
  var nuevas = horas.map(function (h) {
    var archivo = h.archivo ? guardarArchivo_(h.archivo) : null;
    return ['gua_' + Utilities.getUuid().slice(0, 12), idAus, fecha, texto_(h.desde), texto_(h.hasta), h.grupo, h.aula,
      h.tarea, archivo ? archivo.id : '', archivo ? archivo.nombre : '', '', 'PENDIENTE', '', '', sello];
  });
  // Reparto automático, teniendo en cuenta lo ya asignado y quién está ausente
  var todasAusencias = ausencias.concat([[idAus, fecha, email, '', '', '', 'ACTIVA']]);
  var todas = guardias.concat([]);
  nuevas.forEach(function (n) {
    n[G.asignada] = elegirDocente_(fecha, minutos_(n[G.desde]), minutos_(n[G.hasta]), todas, todasAusencias, ahora, n[G.grupo]);
    todas.push(n);
  });
  anadirFilas_(HOJA_GUARDIAS, nuevas);
  // Si el docente ausente tenía guardias asignadas ese día, se reparten de nuevo
  var hojaG = hoja_(HOJA_GUARDIAS);
  var reasignadas = 0;
  guardias.forEach(function (g, k) {
    if (g[G.fecha] !== fecha || g[G.asignada] !== email || g[G.estado] !== 'PENDIENTE') return;
    g[G.asignada] = '';
    g[G.asignada] = elegirDocente_(fecha, minutos_(g[G.desde]), minutos_(g[G.hasta]), todas, todasAusencias, ahora, g[G.grupo]);
    hojaG.getRange(k + 2, G.asignada + 1).setValues([[g[G.asignada]]]);
    reasignadas++;
  });
  var r = { ok: true, id: idAus, horas: nuevas.length };
  // El docente que registra su ausencia no sabe si alguna hora queda sin cubrir: solo Jefatura/Dirección
  if (u.jefatura) {
    r.reasignadas = reasignadas;
    r.sinCubrir = nuevas.filter(function (n) { return !n[G.asignada]; }).length;
  }
  return r;
}

function anularAusencia_(u, req, ahora) {
  var hoja = hoja_(HOJA_AUSENCIAS);
  var ausencias = filas_(HOJA_AUSENCIAS);
  var i = indice_(ausencias, A.id, req.id);
  if (i < 0 || ausencias[i][A.estado] !== 'ACTIVA') return fallo_('ERROR_NO_ENCONTRADA');
  if (ausencias[i][A.email] !== u.email) exigirJefatura_(u);
  hoja.getRange(i + 2, A.estado + 1).setValues([['ANULADA']]);
  var hojaG = hoja_(HOJA_GUARDIAS);
  filas_(HOJA_GUARDIAS).forEach(function (g, k) {
    if (g[G.ausencia] === req.id && g[G.estado] === 'PENDIENTE') {
      hojaG.getRange(k + 2, G.estado + 1, 1, 4).setValues([['ANULADA', g[G.incidencias], u.email, ahora.toISOString()]]);
    }
  });
  return { ok: true };
}

/** Quitar una hora de una ausencia. Si no le quedan horas, la ausencia se anula. */
function quitarHora_(u, req, ahora) {
  var guardias = filas_(HOJA_GUARDIAS);
  var i = indice_(guardias, G.id, req.id);
  if (i < 0 || guardias[i][G.estado] === 'ANULADA') return fallo_('ERROR_NO_ENCONTRADA');
  var g = guardias[i];
  var ausencias = filas_(HOJA_AUSENCIAS);
  var ia = indice_(ausencias, A.id, g[G.ausencia]);
  if (ia < 0 || ausencias[ia][A.estado] !== 'ACTIVA') return fallo_('ERROR_NO_ENCONTRADA');
  if (ausencias[ia][A.email] !== u.email) exigirJefatura_(u);
  if (g[G.fecha] < fechaTexto_(ahora) && !u.jefatura) return fallo_('ERROR_PASADA');
  if (g[G.estado] === 'HECHA') return fallo_('ERROR_YA_HECHA');
  hoja_(HOJA_GUARDIAS).getRange(i + 2, G.estado + 1, 1, 4).setValues([['ANULADA', g[G.incidencias], u.email, ahora.toISOString()]]);
  var quedan = guardias.some(function (o, k) { return k !== i && o[G.ausencia] === g[G.ausencia] && o[G.estado] !== 'ANULADA'; });
  if (!quedan) hoja_(HOJA_AUSENCIAS).getRange(ia + 2, A.estado + 1).setValues([['ANULADA']]);
  return { ok: true, ausenciaAnulada: !quedan };
}

/** Guardias asignadas al docente un día (hoy si no se indica): se le avisan al entrar en el módulo. */
function misGuardias_(u, req, ahora) {
  var fecha = req.fecha ? validarFecha_(req.fecha, true) : fechaTexto_(ahora);
  var prof = profesorado_();
  var ausencias = {};
  filas_(HOJA_AUSENCIAS).forEach(function (a) { if (a[A.estado] === 'ACTIVA') ausencias[a[A.id]] = a; });
  var lista = filas_(HOJA_GUARDIAS).filter(function (g) {
    return g[G.fecha] === fecha && g[G.asignada] === u.email && g[G.estado] !== 'ANULADA' && ausencias[g[G.ausencia]];
  }).map(function (g) { return vistaGuardia_(g, prof, u, ausencias[g[G.ausencia]]); });
  lista.sort(function (a, b) { return a.desde.localeCompare(b.desde); });
  return { ok: true, fecha: fecha, guardias: lista };
}

function misAusencias_(u, req, ahora) {
  var guardias = filas_(HOJA_GUARDIAS);
  var prof = profesorado_();
  var lista = filas_(HOJA_AUSENCIAS).filter(function (a) { return a[A.email] === u.email && a[A.estado] === 'ACTIVA'; })
    .map(function (a) {
      return { id: a[A.id], fecha: a[A.fecha], motivo: a[A.motivo],
        horas: guardias.filter(function (g) { return g[G.ausencia] === a[A.id] && g[G.estado] !== 'ANULADA'; }).map(function (g) {
          return vistaGuardia_(g, prof, u, a);
        }) };
    });
  lista.sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
  return { ok: true, ausencias: lista.slice(0, 60) };
}

// ───────────────────────── Vista del día ─────────────────────────

/** Guardias del día por hora, y el cuadrante (quién está de guardia en cada franja, también en el recreo). */
function dia_(u, req, ahora) {
  var fecha = req.fecha ? validarFecha_(req.fecha, true) : fechaTexto_(ahora);
  var prof = profesorado_();
  var ausencias = {};
  filas_(HOJA_AUSENCIAS).forEach(function (a) { if (a[A.estado] === 'ACTIVA') ausencias[a[A.id]] = a; });
  var guardias = filas_(HOJA_GUARDIAS).filter(function (g) { return g[G.fecha] === fecha && g[G.estado] !== 'ANULADA' && ausencias[g[G.ausencia]]; })
    .map(function (g) { return vistaGuardia_(g, prof, u, ausencias[g[G.ausencia]]); });
  guardias.sort(function (a, b) { return a.desde.localeCompare(b.desde) || a.ausente.localeCompare(b.ausente, 'es'); });

  var dia = diaSemana_(fecha);
  var franjas = {};
  var horario = central_().horario;
  Object.keys(horario).forEach(function (e) {
    if (!prof[e]) return;
    horario[e].forEach(function (t) {
      if (t[0] !== dia || !/^GUARDIA/.test(t[3])) return;
      var k = texto_(t[1]) + '-' + texto_(t[2]);
      (franjas[k] = franjas[k] || { desde: texto_(t[1]), hasta: texto_(t[2]), recreo: t[3] === 'GUARDIA_RECREO', docentes: [] })
        .docentes.push({ email: e, nombre: prof[e].nombre });
    });
  });
  var cuadrante = Object.keys(franjas).map(function (k) { return franjas[k]; });
  cuadrante.sort(function (a, b) { return a.desde.localeCompare(b.desde); });
  cuadrante.forEach(function (f) { f.docentes.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); }); });
  return { ok: true, fecha: fecha, guardias: guardias, cuadrante: cuadrante };
}

function vistaGuardia_(g, prof, u, ausencia) {
  var asignada = g[G.asignada];
  var v = {
    id: g[G.id], fecha: g[G.fecha], desde: comoHora_(g[G.desde]), hasta: comoHora_(g[G.hasta]), grupo: g[G.grupo], aula: g[G.aula],
    tarea: g[G.tarea], archivo: g[G.archivoNombre] || '', asignada: asignada,
    asignadaNombre: asignada ? (prof[asignada] ? prof[asignada].nombre : asignada) : '',
    estado: g[G.estado], incidencias: g[G.incidencias], mia: asignada === u.email
  };
  // Las horas de la propia ausencia: el docente no ve quién la cubre ni si ha quedado sin cubrir
  if (ausencia && ausencia[A.email] === u.email && !u.jefatura) {
    v.propia = true;
    v.asignada = ''; v.asignadaNombre = ''; v.estado = ''; v.incidencias = ''; v.mia = false;
  }
  if (ausencia) {
    v.ausente = prof[ausencia[A.email]] ? prof[ausencia[A.email]].nombre : ausencia[A.email];
    v.ausenteEmail = ausencia[A.email];
    v.idAusencia = ausencia[A.id];
    // El motivo es un dato personal: solo Jefatura/Dirección y el propio docente
    if (u.jefatura || ausencia[A.email] === u.email) v.motivo = ausencia[A.motivo];
  }
  return v;
}

function marcarHecha_(u, req, ahora) {
  var guardias = filas_(HOJA_GUARDIAS);
  var i = indice_(guardias, G.id, req.id);
  if (i < 0 || guardias[i][G.estado] === 'ANULADA') return fallo_('ERROR_NO_ENCONTRADA');
  if (guardias[i][G.asignada] !== u.email) exigirJefatura_(u);
  var hecha = req.hecha !== false;
  hoja_(HOJA_GUARDIAS).getRange(i + 2, G.estado + 1, 1, 4).setValues([[hecha ? 'HECHA' : 'PENDIENTE',
    textoSeguro_(String(req.incidencias || '').trim().slice(0, 2000)), u.email, ahora.toISOString()]]);
  return { ok: true };
}

/** Jefatura: cambiar quién cubre una guardia (email vacío = sin cubrir). */
function asignar_(u, req, ahora) {
  exigirJefatura_(u);
  var guardias = filas_(HOJA_GUARDIAS);
  var i = indice_(guardias, G.id, req.id);
  if (i < 0 || guardias[i][G.estado] === 'ANULADA') return fallo_('ERROR_NO_ENCONTRADA');
  var email = norm_(req.email);
  if (email && !profesorado_()[email]) return fallo_('401_UNAUTHORIZED');
  hoja_(HOJA_GUARDIAS).getRange(i + 2, G.asignada + 1).setValues([[email]]);
  hoja_(HOJA_GUARDIAS).getRange(i + 2, G.actualizada + 1).setValues([[ahora.toISOString()]]);
  return { ok: true };
}

/** Un docente de guardia a esa hora coge una guardia que ha quedado sin cubrir. */
function coger_(u, req, ahora) {
  var guardias = filas_(HOJA_GUARDIAS);
  var i = indice_(guardias, G.id, req.id);
  if (i < 0 || guardias[i][G.estado] === 'ANULADA') return fallo_('ERROR_NO_ENCONTRADA');
  var g = guardias[i];
  if (g[G.asignada]) return fallo_('ERROR_YA_ASIGNADA');
  if (!deGuardia_(u.email, diaSemana_(g[G.fecha]), minutos_(g[G.desde]), minutos_(g[G.hasta]))) return fallo_('ERROR_NO_ES_DE_GUARDIA');
  // Nadie cubre dos grupos a la vez
  var d1 = minutos_(g[G.desde]), h1 = minutos_(g[G.hasta]);
  var ocupado = guardias.some(function (o, k) {
    return k !== i && o[G.estado] !== 'ANULADA' && o[G.fecha] === g[G.fecha] && o[G.asignada] === u.email &&
      solapa_(d1, h1, minutos_(o[G.desde]), minutos_(o[G.hasta]));
  });
  if (ocupado) return fallo_('ERROR_YA_TIENE_GUARDIA');
  hoja_(HOJA_GUARDIAS).getRange(i + 2, G.asignada + 1).setValues([[u.email]]);
  hoja_(HOJA_GUARDIAS).getRange(i + 2, G.actualizada + 1).setValues([[ahora.toISOString()]]);
  return { ok: true };
}

/** Jefatura: guardias de cada docente en el curso (empieza de cero el 1 de septiembre). */
function recuento_(u, ahora) {
  exigirJefatura_(u);
  var prof = profesorado_();
  var inicio = inicioCurso_(ahora);
  var cuenta = {};
  Object.keys(prof).forEach(function (e) { cuenta[e] = { email: e, nombre: prof[e].nombre, hechas: 0, pendientes: 0, conflictivas: 0, horasGuardia: 0 }; });
  var horario = central_().horario;
  Object.keys(horario).forEach(function (e) {
    if (cuenta[e]) cuenta[e].horasGuardia = horario[e].filter(function (t) { return t[3] === 'GUARDIA'; }).length;
  });
  filas_(HOJA_GUARDIAS).forEach(function (g) {
    var c = cuenta[g[G.asignada]];
    if (!c || g[G.fecha] < inicio) return;
    if (g[G.estado] === 'HECHA') c.hechas++;
    else if (g[G.estado] === 'PENDIENTE') c.pendientes++;
    if (g[G.estado] !== 'ANULADA' && esConflictivo_(g[G.grupo])) c.conflictivas++;
  });
  var lista = Object.keys(cuenta).map(function (e) { return cuenta[e]; }).filter(function (c) { return c.horasGuardia || c.hechas || c.pendientes; });
  lista.sort(function (a, b) { return b.hechas - a.hechas || a.nombre.localeCompare(b.nombre, 'es'); });
  return { ok: true, desde: inicio, docentes: lista };
}

/** Jefatura: lista de docentes activos (para registrar la ausencia de otro). */
function listaProfesorado_(u) {
  exigirJefatura_(u);
  var prof = profesorado_();
  var lista = Object.keys(prof).map(function (e) { return { email: e, nombre: prof[e].nombre }; });
  lista.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  return { ok: true, profesorado: lista };
}

// ───────────────────────── Reparto ─────────────────────────

function deGuardia_(email, dia, desde, hasta) {
  return (central_().horario[email] || []).some(function (t) {
    return t[0] === dia && t[3] === 'GUARDIA' && solapa_(desde, hasta, t[1], t[2]);
  });
}

/** Grupo conflictivo: todo FP y FP Básica (códigos 1_FRIO, 2_INF, 1FPB, CFGM…) y los de GRUPOS_CONFLICTIVOS. */
function esConflictivo_(grupo) {
  var g = String(grupo || '').toUpperCase().replace(/[^0-9A-Z]/g, ''); // "3º ESO-A", "3ESO_A" → "3ESOA"
  if (!g) return false;
  if (/ESO|BACH|BTO/.test(g)) {
    return GRUPOS_CONFLICTIVOS.some(function (c) { return c.replace(/[^0-9A-Z]/g, '') === g; });
  }
  return /^\d(FPB|FPGB|CFGM|CFGS|INF|FRIO|CALOR)|FPB|CFGM|CFGS/.test(g);
}

/**
 * Docente de guardia para esa hora: está de guardia según su horario, no está ausente ni tiene ya otra
 * guardia a esa hora (quien tiene una ausencia ese día no cuenta). Entre ellos (guardias del curso, hechas + pendientes):
 *   - Grupo conflictivo: el que menos guardias en conflictivos lleva, entre los que no llevan más de TOLERANCIA_TOTAL
 *     guardias por encima del que menos lleva en total; si empatan, el que menos lleva en total.
 *   - Otro grupo: el que menos guardias lleva en total; si empatan, el que más conflictivos ha cubierto.
 * Así todos quedan compensados en número y no van siempre los mismos a los conflictivos, salvo que no haya otro libre.
 * Último desempate: orden alfabético del correo (así el resultado no depende del azar).
 */
function elegirDocente_(fecha, desde, hasta, guardias, ausencias, ahora, grupo) {
  var dia = diaSemana_(fecha);
  var prof = profesorado_();
  var horario = central_().horario;
  var inicio = inicioCurso_(ahora);
  var activas = {};
  ausencias.forEach(function (a) { if (a[A.estado] === 'ACTIVA') activas[a[A.id]] = a[A.email]; });
  var ocupados = {}, cuenta = {}, conflictivas = {};
  guardias.forEach(function (g) {
    if (g[G.estado] === 'ANULADA') return;
    if (g[G.fecha] === fecha && solapa_(desde, hasta, minutos_(g[G.desde]), minutos_(g[G.hasta]))) {
      if (g[G.asignada]) ocupados[g[G.asignada]] = true;
      if (activas[g[G.ausencia]]) ocupados[activas[g[G.ausencia]]] = true;
    }
    if (g[G.asignada] && g[G.fecha] >= inicio) {
      cuenta[g[G.asignada]] = (cuenta[g[G.asignada]] || 0) + 1;
      if (esConflictivo_(g[G.grupo])) conflictivas[g[G.asignada]] = (conflictivas[g[G.asignada]] || 0) + 1;
    }
  });
  // Quien tiene una ausencia ese día no hace guardias ese día
  ausencias.forEach(function (a) { if (a[A.estado] === 'ACTIVA' && a[A.fecha] === fecha) ocupados[a[A.email]] = true; });
  var candidatos = Object.keys(horario).filter(function (e) {
    return prof[e] && !ocupados[e] && horario[e].some(function (t) { return t[0] === dia && t[3] === 'GUARDIA' && solapa_(desde, hasta, t[1], t[2]); });
  });
  if (!candidatos.length) return '';
  var total = function (e) { return cuenta[e] || 0; };
  var conf = function (e) { return conflictivas[e] || 0; };
  if (esConflictivo_(grupo)) {
    var minimo = Math.min.apply(null, candidatos.map(total));
    candidatos = candidatos.filter(function (e) { return total(e) <= minimo + TOLERANCIA_TOTAL; });
    candidatos.sort(function (a, b) { return conf(a) - conf(b) || total(a) - total(b) || a.localeCompare(b); });
  } else {
    candidatos.sort(function (a, b) { return total(a) - total(b) || conf(b) - conf(a) || a.localeCompare(b); });
  }
  return candidatos[0];
}


// ───────────────────────── Archivos de tarea ─────────────────────────

function carpetaTareas_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CARPETA_TAREAS_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* se vuelve a crear */ } }
  var padre = DriveApp.getFileById(libro_().getId()).getParents();
  var base = padre.hasNext() ? padre.next() : DriveApp.getRootFolder();
  var existentes = base.getFoldersByName(CARPETA_TAREAS);
  var carpeta = existentes.hasNext() ? existentes.next() : base.createFolder(CARPETA_TAREAS);
  props.setProperty('CARPETA_TAREAS_ID', carpeta.getId());
  return carpeta;
}

function guardarArchivo_(a) {
  var nombre = limpiar_(a.nombre, 120) || 'tarea';
  var bytes;
  try { bytes = Utilities.base64Decode(String(a.base64 || '')); } catch (e) { error_('ERROR_ARCHIVO'); }
  if (!bytes || !bytes.length || bytes.length > MAX_ARCHIVO_BYTES) error_('ERROR_ARCHIVO');
  var blob = Utilities.newBlob(bytes, String(a.tipo || 'application/octet-stream').slice(0, 100), nombre);
  var f = carpetaTareas_().createFile(blob);
  return { id: f.getId(), nombre: nombre };
}

/** Cualquier docente con sesión puede descargar la tarea (es para quien cubre la guardia). */
function descargarTarea_(u, req) {
  var g = filas_(HOJA_GUARDIAS)[indice_(filas_(HOJA_GUARDIAS), G.id, req.id)];
  if (!g || !g[G.archivoId]) return fallo_('ERROR_NO_ENCONTRADA');
  var blob = DriveApp.getFileById(g[G.archivoId]).getBlob();
  return { ok: true, nombre: g[G.archivoNombre], tipo: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

// ───────────────────────── Hoja ─────────────────────────

/** La hoja de guardias: la del propio script o, en el servidor único, la de la propiedad ID_HOJA_GUARDIAS. */
var LIBRO_ = null;
function libro_() {
  if (LIBRO_) return LIBRO_;
  if (servidorUnico_()) {
    var id = String(PropertiesService.getScriptProperties().getProperty('ID_HOJA_GUARDIAS') || '').trim();
    if (!id) error_('ERROR_CONFIG', 'Falta la propiedad ID_HOJA_GUARDIAS en el servidor de la intranet.');
    LIBRO_ = SpreadsheetApp.openById(id);
  } else {
    LIBRO_ = SpreadsheetApp.getActive();
  }
  return LIBRO_;
}

function hoja_(nombre) {
  var libro = libro_();
  var h = libro.getSheetByName(nombre);
  if (!h) {
    h = libro.insertSheet(nombre);
    h.getRange(1, 1, 1, CABECERAS[nombre].length).setValues([CABECERAS[nombre]]).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

/** Filas (sin cabecera) como texto. */
function filas_(nombre) {
  var h = hoja_(nombre);
  var ultima = h.getLastRow();
  if (ultima < 2) return [];
  return h.getRange(2, 1, ultima - 1, CABECERAS[nombre].length).getValues().map(function (f) {
    return f.map(function (v, k) {
      if (v instanceof Date) return (nombre === HOJA_GUARDIAS && (k === G.desde || k === G.hasta)) ? texto_(minutosDe_(v)) : fechaTexto_(v);
      return String(v === null || v === undefined ? '' : v);
    });
  });
}

function anadirFilas_(nombre, filas) {
  if (!filas.length) return;
  var h = hoja_(nombre);
  var desde = h.getLastRow() + 1;
  h.getRange(desde, 1, filas.length, filas[0].length).setNumberFormat('@');
  h.getRange(desde, 1, filas.length, filas[0].length).setValues(filas.map(function (f) { return f.map(textoSeguro_); }));
}

function indice_(filas, col, valor) {
  for (var i = 0; i < filas.length; i++) if (filas[i][col] === String(valor || '')) return i;
  return -1;
}

function configurarHoja() {
  Object.keys(CABECERAS).forEach(function (n) { hoja_(n); });
  libro_().setSpreadsheetTimeZone(ZONA);
  Logger.log('Hoja preparada: pestañas ' + Object.keys(CABECERAS).join(', ') + '.');
}

function conCerrojo_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(ESPERA_CERROJO_MS); } catch (e) { return fallo_('ERROR_OCUPADO'); }
  try { return fn(); } finally { lock.releaseLock(); }
}

// ───────────────────────── Fechas y horas ─────────────────────────

function fechaTexto_(d) { return Utilities.formatDate(d, ZONA, 'yyyy-MM-dd'); }

function validarFecha_(v, cualquierDia) {
  var t = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) error_('ERROR_FECHA');
  if (!cualquierDia && diaSemana_(t) > 5) error_('ERROR_FECHA');
  return t;
}

/** 1 = lunes … 7 = domingo, de una fecha 'yyyy-MM-dd' (sin depender de la zona). */
function diaSemana_(fecha) {
  var p = fecha.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return d === 0 ? 7 : d;
}

function inicioCurso_(ahora) {
  var t = fechaTexto_(ahora);
  var y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7));
  return (m >= 9 ? y : y - 1) + '-09-01';
}

function minutos_(v) {
  if (v instanceof Date) return minutosDe_(v);
  var m = /^(\d{1,2})[:.](\d{2})/.exec(String(v || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function minutosDe_(d) {
  return Number(Utilities.formatDate(d, ZONA, 'H')) * 60 + Number(Utilities.formatDate(d, ZONA, 'm'));
}

function texto_(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }

function comoHora_(v) { var m = minutos_(v); return m === null ? String(v || '') : texto_(m); }

function solapa_(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }

/** Texto escrito por un usuario que va a una celda: si empieza por = + - @ se guarda como texto, nunca como fórmula. */
function textoSeguro_(v) {
  if (typeof v !== 'string') return v;
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function limpiar_(v, max) {
  return String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
}

// ───────────────────────── Servidor único de la intranet ─────────────────────────

/** Lo que el servidor central usa de este módulo cuando va en su mismo proyecto. */
/** Reloj simulado: { real, ficticio } en milisegundos, o null si está apagado (en PRODUCCIÓN, siempre null). */
function relojSimulado_() {
  if (typeof ES_PRUEBAS !== 'undefined' && ES_PRUEBAS !== true) return null;
  var v = PropertiesService.getScriptProperties().getProperty('RELOJ_PRUEBAS');
  return v ? JSON.parse(v) : null;
}

function ahoraServidor_() {
  var r = relojSimulado_();
  var ahora = new Date();
  return r ? new Date(r.ficticio + (ahora.getTime() - r.real)) : ahora;
}

// ───────────────────────── Reloj de pruebas (solo servidor único de PRUEBAS) ─────────────────────────

/** El reloj simulado solo se puede cambiar desde la web en el servidor único de PRUEBAS (ES_PRUEBAS de Intranet.gs). */
function relojPermitido_() { return typeof ES_PRUEBAS !== 'undefined' && ES_PRUEBAS === true; }

/**
 * Acción relojPruebas: sin datos devuelve el reloj; { fijar: 'AAAA-MM-DD HH:mm' } hace que la intranet crea que es
 * ese día y esa hora (y el reloj avanza desde ahí); { quitar: true } vuelve a la hora real. Es común a salidas y
 * guardias (propiedad RELOJ_PRUEBAS del proyecto). En PRODUCCIÓN no existe.
 */
function relojPruebas_(req) {
  if (!relojPermitido_()) return fallo_('ERROR_ACCION');
  var props = PropertiesService.getScriptProperties();
  if (req.quitar) props.deleteProperty('RELOJ_PRUEBAS');
  else if (req.fijar) {
    var m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})$/.exec(String(req.fijar));
    if (!m) return fallo_('ERROR_PETICION');
    var base = new Date(m[1] + 'T12:00:00Z');
    if (isNaN(base.getTime())) return fallo_('ERROR_PETICION');
    var ficticio = base.getTime() + ((Number(m[2]) * 60 + Number(m[3])) - minutosDe_(base)) * 60000;
    props.setProperty('RELOJ_PRUEBAS', JSON.stringify({ real: new Date().getTime(), ficticio: ficticio }));
  }
  var ahora = ahoraServidor_();
  return { ok: true, simulado: relojSimulado_() !== null, ahora: ahora.getTime(),
    texto: Utilities.formatDate(ahora, ZONA, 'yyyy-MM-dd HH:mm') };
}

function interfazUnica_() {
  return {
    atender: function (req, email) { return atender_(req, ahoraServidor_(), email); },
    limpiarCacheCentral: limpiarCache,
    editor: { configurarHoja: configurarHoja, probarServidorCentral: probarServidorCentral, limpiarCache: limpiarCache }
  };
}
