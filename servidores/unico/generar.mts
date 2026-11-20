/**
 * Servidor único de la intranet: prepara los archivos que se pegan en el proyecto de Apps Script del
 * servidor central (API_Intranet_PRUEBAS):
 *
 *   Intranet.gs  el servidor central (convivencia, panel y sesión de toda la intranet)
 *   Salidas.gs   el módulo de salidas al baño (de servidores/salidas/Code.gs)
 *   Guardias.gs  el módulo de guardias (de servidores/guardias/Code.gs)
 *
 * Cada módulo va encerrado en su propio espacio (MODULO_SALIDAS, MODULO_GUARDIAS) para que sus funciones
 * no choquen con las del servidor central aunque se llamen igual. Las funciones de editor de cada módulo
 * quedan a la vista con su nombre delante (salidasConfigurarHoja, guardiasProbarServidorCentral…).
 *
 *   npx tsx servidores/unico/generar.mts <carpeta>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarServidorAppsScript } from '../../src/modulos/convivencia/services/appsScriptServidor.ts';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MODULOS = [
  { nombre: 'salidas', variable: 'MODULO_SALIDAS', archivo: 'Salidas.gs', titulo: 'Salidas al baño',
    editor: ['configurarHoja', 'limpiarCache', 'probarServidorCentral', 'cerrarSalidasAbiertas', 'activarModoPruebas', 'desactivarModoPruebas'] },
  { nombre: 'guardias', variable: 'MODULO_GUARDIAS', archivo: 'Guardias.gs', titulo: 'Guardias',
    editor: ['configurarHoja', 'probarServidorCentral', 'limpiarCache'] },
];

function envolver(m: (typeof MODULOS)[number]): string {
  const codigo = fs.readFileSync(path.join(RAIZ, m.nombre, 'Code.gs'), 'utf8');
  const prefijo = m.nombre;
  const editor = m.editor.map((f) => {
    const global = prefijo + f[0].toUpperCase() + f.slice(1);
    return `/** EDITOR (${m.titulo}): ${f}. */\nfunction ${global}() { ${m.variable}.editor.${f}(); }`;
  }).join('\n\n');
  return `/**
 * ${m.titulo} · servidor único de la intranet IES Blas Infante.
 * ARCHIVO GENERADO desde servidores/${m.nombre}/Code.gs con servidores/unico/generar.mts: no editar aquí.
 * Va en el mismo proyecto que Intranet.gs. Su hoja de cálculo: propiedad ID_HOJA_${m.nombre.toUpperCase()}.
 */
var ${m.variable} = (function () {

${codigo.trim()}

return interfazUnica_();
})();

// ───────────────────────── Funciones para ejecutar desde el editor ─────────────────────────

${editor}
`;
}

/** { 'Intranet.gs': código, 'Salidas.gs': código, 'Guardias.gs': código } */
export function generarServidorUnico(): Record<string, string> {
  const r: Record<string, string> = { 'Intranet.gs': generarServidorAppsScript() };
  for (const m of MODULOS) r[m.archivo] = envolver(m);
  return r;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const destino = process.argv[2];
  if (!destino) { console.error('Uso: npx tsx servidores/unico/generar.mts <carpeta>'); process.exit(1); }
  fs.mkdirSync(destino, { recursive: true });
  for (const [nombre, codigo] of Object.entries(generarServidorUnico())) {
    fs.writeFileSync(path.join(destino, nombre), codigo);
    console.log('Escrito', path.join(destino, nombre));
  }
}
