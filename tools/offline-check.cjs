/* Offline check for the production build: serve dist (npm run preview), then `npm run test:offline -- http://localhost:4173/ firefox`. Loads the app, lets the worker cache the shell and the sample deck frames, goes offline and reloads. */
const pw = require('playwright');

const url = process.argv[2] || 'http://localhost:4173/';
const engine = process.argv[3] || 'firefox';

(async () => {
  const browser = await pw[engine].launch();
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('.welcome', { timeout: 30000 });
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, active: !!reg.active, controller: !!navigator.serviceWorker.controller };
  });
  // the first load is not controlled yet; a reload is
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.welcome', { timeout: 30000 });
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  await page.getByRole('button', { name: 'Load sample deck' }).click();
  await page.waitForSelector('.preview-canvas', { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.preview-toolbar .badge.muted'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const out = {};
    for (const k of keys) out[k] = (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname);
    return out;
  });
  await context.setOffline(true);
  let offline = {};
  try {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.deck-list li', { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('.preview-toolbar .badge.muted'), null, { timeout: 30000 });
    offline = await page.evaluate(() => ({
      cards: document.querySelectorAll('.deck-list li').length,
      canvas: !!document.querySelector('.preview-canvas'),
      error: document.querySelector('.preview-error')?.textContent ?? null,
      title: document.title,
    }));
  } catch (e) {
    offline = { failed: String(e).slice(0, 300) };
  }
  await browser.close();
  const files = Object.values(cached).flat();
  console.log(
    JSON.stringify(
      {
        sw,
        controlled,
        cacheNames: Object.keys(cached),
        cachedCount: files.length,
        sample: files.filter((f) => !f.includes('/frames/')).slice(0, 12),
        frames: files.filter((f) => f.includes('/frames/')).length,
        offline,
        errors,
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
