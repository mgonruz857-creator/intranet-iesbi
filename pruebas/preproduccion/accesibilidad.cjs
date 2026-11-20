// Antes de producción: recorre la intranet (servidor local con el centro ficticio) en móvil y ordenador, con
// distintos perfiles, y comprueba en cada pantalla: errores de la página, que nada se salga por el lado,
// botones demasiado pequeños para el dedo y accesibilidad (axe-core, normas WCAG 2.1 A y AA).
// Uso: arrancar el servidor local y la app (ver pruebas/usuarios/README.md) y luego
//   AXE=/ruta/a/axe.min.js node pruebas/preproduccion/accesibilidad.cjs
const fs = require('fs');
const { chromium, abrir, entrar, botonesPequenos, desborda, OUT, URL } = require('../usuarios/lib.cjs');
const AXE = fs.readFileSync(process.env.AXE, 'utf8');
const CLAVE = 'Prueba2026x';
const D = '@g.educaand.es';
const PERFILES = [
  { quien: 'admin-ordenador', email: 'mgonruz857' + D, clave: 'Infante2026', movil: false, rutas: ['', 'convivencia', 'salidas', 'guardias', 'panel'] },
  { quien: 'jefatura-movil', email: 'rosa.jefatura.ficticia' + D, clave: CLAVE, movil: true, rutas: ['', 'convivencia', 'salidas', 'guardias', 'panel'] },
  { quien: 'docente-movil', email: 'carmen.veterana.ficticia' + D, clave: CLAVE, movil: true, rutas: ['', 'convivencia', 'salidas', 'guardias'] },
  { quien: 'docente-ordenador', email: 'javier.joven.ficticio' + D, clave: CLAVE, movil: false, rutas: ['', 'convivencia', 'salidas', 'guardias'] },
];

(async () => {
  const b = await chromium.launch();
  const informe = [];
  // Pantalla de entrada (sin sesión)
  {
    const { p, ctx } = await abrir(b, 'entrada', true);
    await p.goto(URL + '/#/'); await p.waitForSelector('input[type=email]');
    await p.addScriptTag({ content: AXE });
    const r = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations
      .map((v) => ({ id: v.id, impacto: v.impact, ayuda: v.help, n: v.nodes.length, ej: v.nodes.slice(0, 3).map((x) => x.target.join(' ') + ' :: ' + (x.failureSummary || '').split('\n')[1]) })));
    informe.push({ quien: 'entrada', ruta: 'login', axe: r, pequenos: await botonesPequenos(p), desborda: await desborda(p), errores: [] });
    await ctx.close();
  }
  for (const pf of PERFILES) {
    const { p, ctx, diario } = await abrir(b, pf.quien, pf.movil);
    await entrar(p, pf.email, pf.clave);
    // Primer acceso: puede pedir cambiar la contraseña o enseñar un aviso; se cierra lo que haya
    await p.keyboard.press('Escape').catch(() => {});
    for (const ruta of pf.rutas) {
      const antes = diario.errores.length;
      await p.goto(URL + '/#/' + ruta); await p.waitForTimeout(ruta ? 5000 : 2500);
      await p.keyboard.press('Escape').catch(() => {});
      await p.addScriptTag({ content: AXE });
      const r = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations
        .map((v) => ({ id: v.id, impacto: v.impact, ayuda: v.help, n: v.nodes.length, ej: v.nodes.slice(0, 3).map((x) => x.target.join(' ') + ' :: ' + (x.failureSummary || '').split('\n')[1]) })));
      const img = `${OUT}/a11y-${pf.quien}-${ruta || 'portada'}.png`;
      await p.screenshot({ path: img, fullPage: false });
      const item = { quien: pf.quien, ruta: ruta || 'portada', axe: r, pequenos: pf.movil ? await botonesPequenos(p) : [], desborda: await desborda(p),
        errores: diario.errores.slice(antes), texto: (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160) };
      informe.push(item);
      console.log(`${pf.quien} #/${ruta}: axe ${r.length} reglas (${r.map((v) => v.id + '×' + v.n).join(', ')}), pequeños ${item.pequenos.length}, desborda ${item.desborda}, errores ${item.errores.length}`);
    }
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/accesibilidad.json`, JSON.stringify(informe, null, 1));
  await b.close();
})();
