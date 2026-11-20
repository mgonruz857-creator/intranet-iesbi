// Carmen, 62 años, poca soltura: móvil, escribe despacio, se equivoca, pulsa dos veces. Primer acceso.
const { chromium, URL, abrir, botonesPequenos, desborda, guardar } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const { p, diario, paso, texto } = await abrir(b, 'carmen', true);
  const notas = (diario.notas = []);

  await paso('Abre la intranet y escribe su correo con mayúscula y un espacio al final', async () => {
    await p.goto(URL + '/#/'); await p.waitForSelector('input[type=email]');
    await p.locator('input[type=email]').pressSequentially('Carmen.Veterana.Ficticia@g.educaand.es ', { delay: 50 });
    await p.locator('input[type=email]').blur(); await p.waitForTimeout(3000);
    const n = (await p.$$('input[type=password]')).length;
    return `campos de contraseña: ${n}; ` + (await texto()).match(/(primer|Primer|cree|Cree|elija|Elija)[^.]{0,120}/)?.[0];
  });
  await paso('Pone una contraseña corta ("carmen")', async () => {
    for (const i of await p.$$('input[type=password]')) await i.fill('carmen');
    await p.click('button[type=submit]'); await p.waitForTimeout(3000);
    return (await texto()).match(/(contraseña|clave)[^.]{0,140}/i)?.[0];
  });
  await paso('Repite la contraseña pero se equivoca en la segunda', async () => {
    const c = await p.$$('input[type=password]');
    await c[0].fill('Carmen2026!'); if (c[1]) await c[1].fill('Carmen2026');
    await p.click('button[type=submit]'); await p.waitForTimeout(3000);
    return (await texto()).match(/(no coinciden|coincid)[^.]{0,100}/i)?.[0] || 'sin aviso visible';
  });
  await paso('Escribe bien las dos contraseñas y entra', async () => {
    for (const i of await p.$$('input[type=password]')) await i.fill('Carmen2026!');
    await p.click('button[type=submit]'); await p.waitForSelector('text=Aplicaciones del centro', { timeout: 20000 });
  });
  notas.push({ pantalla: 'portada', pequenos: await botonesPequenos(p), desborda: await desborda(p) });

  await paso('Entra en Convivencia', async () => {
    await p.click('text=Convivencia'); await p.waitForSelector('text=Registrar Parte', { timeout: 30000 });
  });
  notas.push({ pantalla: 'parte', pequenos: (await botonesPequenos(p)).slice(0, 15), desborda: await desborda(p) });
  await paso('Busca su grupo (2º ESO A) entre los botones de grupos', async () => {
    await p.locator('button', { hasText: /^2º ESO A$/ }).first().click(); await p.waitForTimeout(800);
  });
  await paso('Elige a la alumna RUIZ PRUEBA, Lucía', async () => {
    await p.locator('button', { hasText: 'RUIZ PRUEBA' }).first().click(); await p.waitForTimeout(600);
  });
  await paso('Elige "Perturbación del normal desarrollo de la clase"', async () => {
    await p.locator('button', { hasText: 'Perturbación del normal' }).first().click(); await p.waitForTimeout(500);
  });
  await paso('Toca "Usar redacción tipo" para no escribir', async () => {
    await p.click('text=Usar redacción tipo'); await p.waitForTimeout(300);
    return 'texto: ' + (await p.locator('textarea').first().inputValue()).slice(0, 80);
  });
  await paso('Toca "Registrar Parte" dos veces seguidas (impaciente)', async () => {
    const bt = p.locator('button[type=submit]', { hasText: 'Registrar Parte' });
    await bt.scrollIntoViewIfNeeded();
    await bt.click(); await bt.click({ timeout: 1500 }).catch(() => {});
    await p.waitForSelector('text=Registrar otro parte', { timeout: 30000 });
  });
  await paso('Va a "Mis Partes Puestos" para comprobar que está (y que no hay dos)', async () => {
    await p.click('text=Finalizar'); await p.waitForTimeout(1500);
    // Lo busca en la barra de abajo del móvil
    await p.locator('nav[aria-label="Secciones de Convivencia"] button', { hasText: 'Mis partes' }).click(); await p.waitForTimeout(2500);
    const t = await texto();
    return `veces que aparece RUIZ PRUEBA: ${(t.match(/RUIZ PRUEBA/g) || []).length}`;
  });

  await paso('Vuelve a la portada con "Intranet IESBI" y entra en Salidas al baño', async () => {
    await p.click('text=Intranet IESBI'); await p.waitForTimeout(1500);
    await p.click('text=Salidas al baño'); await p.waitForTimeout(7000);
    return (await texto()).match(/(hora[^.]{0,80}|Recreo[^.]{0,40}|Fuera de la jornada[^.]{0,20})/)?.[0];
  });
  notas.push({ pantalla: 'salidas', pequenos: (await botonesPequenos(p)).slice(0, 15), desborda: await desborda(p) });
  await paso('Toca a un alumno para dejarle salir', async () => {
    await p.locator('button', { hasText: 'MORENO EJEMPLO' }).first().click(); await p.waitForTimeout(1000);
    const t = await texto();
    const motivo = p.locator('textarea, input[type=text]').last();
    if (/Motivo de la salida|Justificación/.test(t)) await motivo.fill('Tiene que ir urgentemente');
    return t.match(/(Hora preferente[^.]*|Motivo de la salida[^)]*\)|Justificación[^.]{0,40}|máximo[^.]{0,60})/)?.[0];
  });
  await paso('Autoriza la salida', async () => {
    await p.locator('button', { hasText: /Autorizar|Registrar salida|Dar permiso/ }).last().click(); await p.waitForTimeout(4000);
    return (await texto()).match(/Fuera del aula ahora[^.]{0,120}/)?.[0];
  });
  await paso('El alumno vuelve: lo marca', async () => {
    await p.locator('button', { hasText: /vuelto|Regres|Volvió|Ha vuelto/i }).first().click(); await p.waitForTimeout(4000);
    return (await texto()).match(/Fuera del aula ahora[^.]{0,80}/)?.[0];
  });

  await paso('Va a Guardias → Ausencias para avisar de que el lunes va al médico', async () => {
    await p.goto(URL + '/#/guardias'); await p.waitForTimeout(6000);
    await p.click('text=Ausencias'); await p.waitForTimeout(3000);
    await p.fill('input[type=date]', '2026-11-23'); await p.waitForTimeout(3000);
    return (await texto()).match(/Lunes[^]{0,40}/i)?.[0] || '';
  });
  notas.push({ pantalla: 'ausencias', pequenos: (await botonesPequenos(p)).slice(0, 15), desborda: await desborda(p) });
  await paso('Marca sus dos primeras clases, pone motivo y tarea', async () => {
    const casillas = p.locator('li input[type=checkbox]');
    const n = await casillas.count();
    await casillas.nth(0).check(); if (n > 1) await casillas.nth(1).check();
    await p.locator('input[maxlength="500"]').fill('Cita médica');
    const tareas = p.locator('textarea[placeholder="Tarea para el grupo"]');
    for (let i = 0; i < await tareas.count(); i++) await tareas.nth(i).fill('Hacer los ejercicios de la página 40');
    return `clases ese día: ${n}`;
  });
  await paso('Registra la ausencia', async () => {
    await p.click('text=Registrar ausencia'); await p.waitForTimeout(5000);
    return (await texto()).match(/(registrad[^.]{0,120}|Mis ausencias[^]{0,160})/i)?.[0];
  });
  await paso('Cierra la sesión', async () => {
    await p.click('text=Intranet IESBI').catch(() => {}); await p.waitForTimeout(1500);
    await p.click('text=Cerrar sesión'); await p.waitForTimeout(2500);
    return (await p.$$('input[type=email]')).length ? 'vuelve a la pantalla de entrada' : 'NO vuelve a la entrada';
  });
  guardar(diario); await b.close();
})();
