const { chromium, devices } = require('playwright');
const fs = require('fs');
const URL = 'http://localhost:3014';
const OUT = (process.env.CAPTURAS || '/tmp/perfiles-capturas');
fs.mkdirSync(OUT, { recursive: true });

/** Abre un navegador como lo usaría la persona: móvil o portátil, y registra errores y tiempos. */
async function abrir(b, quien, movil) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  const diario = { quien, pasos: [], errores: [], dialogos: [] };
  p.on('pageerror', (e) => diario.errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') diario.errores.push('consola: ' + m.text().slice(0, 200)); });
  p.on('dialog', (d) => { diario.dialogos.push(d.message().slice(0, 300)); d.accept(); });
  let n = 0;
  const paso = async (texto, fn) => {
    const t0 = Date.now(); let ok = true, nota = '';
    try { nota = (await fn()) || ''; } catch (e) { ok = false; nota = String(e.message || e).split('\n')[0].slice(0, 250); }
    const ms = Date.now() - t0;
    n++;
    const img = `${quien}-${String(n).padStart(2, '0')}.png`;
    await p.screenshot({ path: `${OUT}/${img}` }).catch(() => {});
    diario.pasos.push({ n, texto, ok, ms, nota, img });
    console.log(`${ok ? 'OK ' : 'MAL'} [${quien}] ${texto} (${(ms / 1000).toFixed(1)} s)${nota ? ' → ' + nota : ''}`);
  };
  const texto = async () => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  return { p, ctx, diario, paso, texto };
}

async function entrar(p, email, clave, { primera = false, lento = false } = {}) {
  await p.goto(URL + '/#/');
  await p.waitForSelector('input[type=email]', { timeout: 15000 });
  if (lento) await p.locator('input[type=email]').pressSequentially(email, { delay: 60 });
  else await p.fill('input[type=email]', email);
  await p.locator('input[type=email]').blur();
  await p.waitForTimeout(2500);
  const claves = await p.$$('input[type=password]');
  for (const i of claves) await i.fill(clave);
  await p.click('button[type=submit]');
  await p.waitForTimeout(4000);
  return claves.length;
}

/** Tamaño de los botones y enlaces visibles más pequeños (en móvil, menos de 40 px es difícil de pulsar). */
async function botonesPequenos(p) {
  return p.evaluate(() => [...document.querySelectorAll('button, a, input[type=checkbox], select')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight * 3; })
    .map((e) => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; })
    .filter((x) => x.h < 32 || x.w < 32));
}
async function desborda(p) {
  return p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2 ? document.documentElement.scrollWidth : 0);
}
function guardar(diario) { fs.writeFileSync(`${OUT}/${diario.quien}.json`, JSON.stringify(diario, null, 1)); }
module.exports = { OUT, chromium, URL, abrir, entrar, botonesPequenos, desborda, guardar };
