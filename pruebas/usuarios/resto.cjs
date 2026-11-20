// Resto de perfiles ficticios, en el orden en que pasaría en un día de clase.
const { chromium, URL, abrir, entrar, botonesPequenos, desborda, guardar } = require('./lib.cjs');
const D = '@g.educaand.es';
const solo = process.argv[2];

const PERFILES = {
  // Lucía, 45, soltura media, portátil. Tutora de 1º ESO A. Hoy tiene que irse a 2ª y 3ª hora.
  async lucia(b) {
    const { p, diario, paso, texto } = await abrir(b, 'lucia', false);
    await paso('Primer acceso desde su portátil', async () => { await entrar(p, 'lucia.tutora.ficticia' + D, 'Lucia2026!'); return (await texto()).includes('Aplicaciones del centro') ? 'dentro' : 'NO ENTRA'; });
    await paso('Entra en Convivencia → Mi Tutoría', async () => {
      await p.click('text=Convivencia'); await p.waitForTimeout(6000);
      await p.locator('text=Mi Tutoría').first().click(); await p.waitForTimeout(2500);
      return (await texto()).match(/1º? ?ESO ?A[^.]{0,120}/)?.[0];
    });
    await paso('Busca en su tutoría el carnet de un alumno', async () => {
      const t = await texto(); return `alumnos de su grupo visibles: ${(t.match(/10 pts|10\/10|10 puntos/g) || []).length}; ve teléfonos: ${/600 000 000/.test(t)}`;
    });
    await paso('Va a Guardias → Ausencias y registra hoy la 2ª y 3ª hora', async () => {
      await p.goto(URL + '/#/guardias'); await p.waitForTimeout(6000);
      await p.click('text=Ausencias'); await p.waitForTimeout(3000);
      const casillas = p.locator('li input[type=checkbox]');
      const n = await casillas.count();
      for (let i = 0; i < n; i++) { const txt = await casillas.nth(i).locator('xpath=..').innerText(); if (!/09:15|10:15/.test(txt)) await casillas.nth(i).uncheck(); }
      await p.locator('input[maxlength="500"]').fill('Reunión con la inspección');
      const tareas = p.locator('textarea[placeholder="Tarea para el grupo"]');
      for (let i = 0; i < await tareas.count(); i++) await tareas.nth(i).fill('Terminar la ficha del tema 4');
      await p.click('text=Registrar ausencia'); await p.waitForTimeout(5000);
      const t = await texto();
      return `clases hoy: ${n}; ${t.match(/Ausencia registrada|registrad[^.]{0,60}/)?.[0]}; ¿sabe quién cubre?: ${/cubre|Antonio|Sin cubrir/i.test(t)}`;
    });
    await paso('Mira "Mi horario" y lo imprime', async () => {
      await p.click('text=Mi horario'); await p.waitForTimeout(3000);
      await p.emulateMedia({ media: 'print' }); await p.pdf({ path: '' + require('./lib.cjs').OUT + '/lucia-horario.pdf', preferCSSPageSize: true, printBackground: true });
      await p.emulateMedia({ media: 'screen' });
      return (await texto()).match(/Lunes[^]{0,80}/)?.[0];
    });
    diario.notas = [{ pantalla: 'ausencias', desborda: await desborda(p) }];
    guardar(diario); await p.context().close();
  },

  // Antonio, 55, soltura baja-media, ordenador antiguo de la sala de profesores (pantalla pequeña). De guardia a 2ª y 3ª.
  async antonio(b) {
    const { p, diario, paso, texto } = await abrir(b, 'antonio', false);
    await p.setViewportSize({ width: 1024, height: 600 });
    await paso('Primer acceso en el ordenador de la sala (equipo compartido)', async () => { await entrar(p, 'antonio.guardia.ficticio' + D, 'Antonio2026'); return (await texto()).includes('Aplicaciones del centro') ? 'dentro' : 'NO ENTRA'; });
    await paso('Entra en Guardias y mira qué le toca hoy', async () => {
      await p.click('text=Guardias'); await p.waitForTimeout(7000);
      const t = await texto();
      return t.match(/Guardias del día[^]{0,400}/)?.[0];
    });
    await paso('Abre la tarea de la primera guardia', async () => {
      await p.locator('button', { hasText: /^Tarea$/ }).first().click(); await p.waitForTimeout(800);
      return (await texto()).match(/Terminar la ficha[^.]{0,30}|Sin tarea escrita/)?.[0];
    });
    await paso('Escribe una incidencia y la marca como hecha', async () => {
      await p.fill('textarea[placeholder="Incidencias (opcional)"], input[placeholder="Incidencias (opcional)"]', 'Dos alumnos sin material');
      await p.click('text=Marcar como hecha'); await p.waitForTimeout(4000);
      return (await texto()).match(/Guardia marcada como hecha|Hecha/)?.[0];
    });
    diario.notas = [{ pantalla: 'guardias', pequenos: (await botonesPequenos(p)).slice(0, 10), desborda: await desborda(p) }];
    await paso('Se va sin cerrar sesión (equipo compartido): ¿qué ve el siguiente?', async () => {
      const ctx = p.context(); const p2 = await ctx.newPage(); await p2.goto(URL + '/#/guardias'); await p2.waitForTimeout(5000);
      const t = (await p2.locator('body').innerText()).replace(/\s+/g, ' ');
      return /Guardia Ficticio, Antonio|Antonio/.test(t) && !/input/.test('') ? 'la sesión de Antonio sigue abierta en otra pestaña' : 'pide entrar de nuevo';
    });
    guardar(diario); await p.context().close();
  },

  // Javier, 28, mucha soltura, móvil, rápido. Quiere poner un parte en menos de 30 segundos.
  async javier(b) {
    const { p, diario, paso, texto } = await abrir(b, 'javier', true);
    await paso('Primer acceso desde el móvil', async () => { await entrar(p, 'javier.joven.ficticio' + D, 'Javi2026x'); return (await texto()).includes('Aplicaciones del centro') ? 'dentro' : 'NO ENTRA'; });
    let t0;
    await paso('Parte rápido: grupo, alumno, conducta grave (móvil), escribe hechos y envía', async () => {
      await p.click('text=Convivencia'); await p.waitForSelector('text=Registrar Parte', { timeout: 30000 });
      t0 = Date.now();
      await p.locator('button', { hasText: /^3º ESO A$/ }).first().click();
      await p.locator('button', { hasText: 'GIL ENSAYO' }).first().click();
      await p.locator('button', { hasText: 'CONDUCTAS GRAVES' }).first().click(); await p.waitForTimeout(300);
      const movil = p.locator('button', { hasText: /móvil|Móvil/ }).first();
      const hay = await movil.count(); if (hay) await movil.click(); else await p.locator('button', { hasText: /pts/ }).nth(3).click();
      await p.locator('textarea').first().fill('Usa el móvil en clase tras dos avisos.');
      await p.locator('button[type=submit]', { hasText: 'Registrar Parte' }).click();
      await p.waitForSelector('text=Registrar otro parte', { timeout: 30000 });
      return `tiempo desde que elige grupo hasta el parte guardado: ${((Date.now() - t0) / 1000).toFixed(1)} s; conducta del móvil encontrada: ${!!hay}`;
    });
    await paso('Salida al baño buscando al alumno por nombre', async () => {
      await p.goto(URL + '/#/salidas'); await p.waitForTimeout(7000);
      const sel = p.locator('select').first(); if (await sel.count()) await sel.selectOption({ label: '3º ESO A' }).catch(() => {});
      await p.fill('input[placeholder="Buscar alumno…"]', 'vargas'); await p.waitForTimeout(500);
      await p.locator('button', { hasText: 'VARGAS' }).first().click(); await p.waitForTimeout(800);
      const t = await texto();
      if (/Motivo de la salida|Justificación/.test(t)) await p.locator('textarea, input[type=text]').last().fill('Urgente');
      await p.locator('button', { hasText: /Autorizar/ }).last().click(); await p.waitForTimeout(4000);
      return (await texto()).match(/Fuera del aula ahora[^.]{0,100}|ya ha salido[^.]{0,80}|máximo[^.]{0,80}/)?.[0];
    });
    await paso('Intenta dejar salir a otro alumno cuando ya hay uno fuera', async () => {
      await p.fill('input[placeholder="Buscar alumno…"]', 'gil'); await p.waitForTimeout(500);
      await p.locator('button', { hasText: 'GIL ENSAYO' }).first().click(); await p.waitForTimeout(800);
      return (await texto()).match(/(ya hay[^.]{0,100}|fuera del aula[^.]{0,80}|no se puede[^.]{0,80}|Hora preferente[^.]{0,60}|Motivo[^.]{0,60})/i)?.[0];
    });
    await p.keyboard.press('Escape');
    await paso('Mira su horario semanal en el móvil', async () => {
      await p.goto(URL + '/#/guardias'); await p.waitForTimeout(6000);
      await p.click('text=Mi horario'); await p.waitForTimeout(3000);
      return `desborda: ${await desborda(p)} px`;
    });
    guardar(diario); await p.context().close();
  },

  // Pedro, sustituto recién llegado (sustituye a Elena, tutora de 3º ESO A), soltura media, móvil.
  async pedro(b) {
    const { p, diario, paso, texto } = await abrir(b, 'pedro', true);
    await paso('Primer acceso del sustituto', async () => { await entrar(p, 'pedro.sustituto.ficticio' + D, 'Pedro2026'); return (await texto()).includes('Aplicaciones del centro') ? 'dentro' : 'NO ENTRA: ' + (await texto()).slice(0, 200); });
    await paso('Mira "Mi horario": ¿le aparece el de Elena?', async () => {
      await p.click('text=Guardias'); await p.waitForTimeout(7000);
      await p.click('text=Mi horario'); await p.waitForTimeout(3000);
      const t = await texto(); return `clases: ${(t.match(/ESO|BACH/g) || []).length}; menciona a la titular: ${/Elena|Titular/.test(t)}`;
    });
    await paso('Entra en Convivencia: ¿tiene la tutoría de 3º ESO A?', async () => {
      await p.goto(URL + '/#/convivencia'); await p.waitForTimeout(7000);
      if (!(await p.locator('text=Mi Tutoría').first().isVisible())) await p.click('[aria-label="Abrir menú"]').catch(() => {});
      await p.waitForTimeout(500);
      const vis = await p.locator('text=Mi Tutoría').first().isVisible().catch(() => false);
      if (vis) { await p.locator('text=Mi Tutoría').first().click(); await p.waitForTimeout(2500); }
      return `Mi Tutoría visible: ${vis}; ${(await texto()).match(/3º? ?ESO ?A[^.]{0,80}/)?.[0]}`;
    });
    guardar(diario); await p.context().close();
  },

  // Elena, la titular de baja, intenta entrar desde casa.
  async elena(b) {
    const { p, diario, paso, texto } = await abrir(b, 'elena', true);
    await paso('Intenta entrar estando de baja', async () => { await entrar(p, 'elena.titular.ficticia' + D, 'Elena2026'); return (await texto()).match(/(sustitu|baja|bloquead|no puede|acceso)[^.]{0,160}/i)?.[0] || (await texto()).slice(0, 200); });
    guardar(diario); await p.context().close();
  },

  // Rosa, Jefatura de Estudios, mucha soltura, portátil. Revisa el día y da de alta a un docente nuevo.
  async rosa(b) {
    const { p, diario, paso, texto } = await abrir(b, 'rosa', false);
    await paso('Primer acceso', async () => { await entrar(p, 'rosa.jefatura.ficticia' + D, 'Rosa2026!'); return (await texto()).includes('Panel del centro') ? 've el Panel del centro' : 'no ve el panel'; });
    await paso('Guardias de hoy: ve quién cubre a Lucía y si hay algo sin cubrir', async () => {
      await p.click('text=Guardias'); await p.waitForTimeout(7000);
      return (await texto()).match(/Guardias del día[^]{0,500}/)?.[0];
    });
    await paso('Imprime el parte del día', async () => {
      await p.emulateMedia({ media: 'print' }); await p.pdf({ path: '' + require('./lib.cjs').OUT + '/rosa-parte.pdf', preferCSSPageSize: true, printBackground: true });
      await p.emulateMedia({ media: 'screen' });
    });
    await paso('Convivencia → Feed Diario: ve los partes de hoy (¿el de Carmen está una sola vez?)', async () => {
      await p.goto(URL + '/#/convivencia'); await p.waitForTimeout(7000);
      await p.click('text=Feed Diario'); await p.waitForTimeout(3000);
      const t = await texto(); return `RUIZ PRUEBA: ${(t.match(/RUIZ PRUEBA/g) || []).length} veces; GIL ENSAYO: ${(t.match(/GIL ENSAYO/g) || []).length} veces`;
    });
    await paso('Salidas → Histórico de hoy', async () => {
      await p.goto(URL + '/#/salidas'); await p.waitForTimeout(7000);
      await p.click('text=Histórico'); await p.waitForTimeout(4000);
      const t = await texto(); return `MORENO: ${/MORENO EJEMPLO/.test(t)}; VARGAS: ${/VARGAS MODELO/.test(t)}`;
    });
    await paso('Panel → Profesorado: da de alta a una profesora nueva', async () => {
      await p.goto(URL + '/#/panel'); await p.waitForTimeout(7000);
      const t = await texto(); return t.match(/(Profesorado[^]{0,300})/)?.[0];
    });
    diario.notas = [{ pantalla: 'panel', desborda: await desborda(p) }];
    guardar(diario); await p.context().close();
  },
};

(async () => {
  const b = await chromium.launch();
  for (const [n, f] of Object.entries(PERFILES)) if (!solo || solo === n) { console.log('\n#### ' + n); try { await f(b); } catch (e) { console.log('ERROR ' + n + ': ' + e.message.split('\n')[0]); } }
  await b.close();
})();
