/* Cross-browser smoke run against a running dev server (or the hosted site).
   Usage: npm run test:browsers -- <url> <firefox|webkit|chromium> [...more]
   Needs the engines once: npx playwright install firefox webkit
   Walks the welcome panel, sample deck, typing, paste, drag reorder, undo, PDF and JSON export and a
   reload in each engine, printing a JSON report. Downloads and screenshots go to the OS temp folder. */
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const pw = require('playwright');
const { PDFDocument } = require('pdf-lib');

const url = process.argv[2];
const engines = process.argv.slice(3);
if (!url || !engines.length) {
  console.error('usage: node tools/browser-smoke.cjs <url> <firefox|webkit|chromium> [...more]');
  process.exit(2);
}
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trek-card-maker-smoke-'));

async function run(engine) {
  const report = { engine, console: [], pageErrors: [], steps: {} };
  const browser = await pw[engine].launch();
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 950 } });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') report.console.push(`${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => report.pageErrors.push(String(e).slice(0, 300)));
  const step = async (name, fn) => {
    try {
      report.steps[name] = await fn();
    } catch (e) {
      report.steps[name] = `FAIL: ${String(e && e.message ? e.message : e).slice(0, 300)}`;
    }
  };

  await step('load', async () => {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('.welcome', { timeout: 20000 });
    return 'welcome shown';
  });

  await step('sample deck renders', async () => {
    await page.getByRole('button', { name: 'Load sample deck' }).click();
    await page.waitForSelector('.preview-canvas', { timeout: 20000 });
    await page.waitForFunction(() => !document.querySelector('.preview-toolbar .badge.muted'), null, { timeout: 20000 });
    const px = await page.evaluate(() => {
      const cv = document.querySelector('.preview-canvas');
      const g = cv.getContext('2d');
      const centre = g.getImageData(Math.round(cv.width * 0.5), Math.round(cv.height * 0.12), 1, 1).data;
      return { w: cv.width, h: cv.height, titleBand: [...centre].slice(0, 3), error: !!document.querySelector('.preview-error') };
    });
    return px;
  });

  await step('typing re-renders', async () => {
    const title = page.getByPlaceholder('Card title');
    await title.fill('Martok');
    await page.waitForFunction(() => !document.querySelector('.preview-toolbar .badge.muted'), null, { timeout: 20000 });
    const names = await page.$$eval('.deck-name span:last-child', (els) => els.map((e) => e.textContent));
    return names;
  });

  await step('paste artwork', async () => {
    const label = await page.evaluate(async () => {
      // Synthetic clipboard events are a test convenience; engines that cannot build one are skipped, not failed.
      if (typeof DataTransfer === 'undefined' || !new DataTransfer().items) return 'skipped: no DataTransfer.items in this engine';
      if (!new ClipboardEvent('paste', { clipboardData: new DataTransfer() }).clipboardData) return 'skipped: synthetic clipboardData unsupported here';
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 480;
      const g = c.getContext('2d');
      g.fillStyle = '#cc3333';
      g.fillRect(0, 0, 640, 480);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const file = new File([blob], 'pasted.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true });
      if (!ev.clipboardData || !ev.clipboardData.files.length) return 'skipped: this engine drops files from synthetic paste events';
      document.dispatchEvent(ev);
      await new Promise((r) => setTimeout(r, 1500));
      return document.querySelector('.image-section .file-button').textContent;
    });
    return label;
  });

  await step('drag reorder', async () => {
    const before = await page.$$eval('.deck-name span:last-child', (els) => els.map((e) => e.textContent));
    const handles = page.locator('.drag-handle');
    await handles.nth(1).dragTo(page.locator('.deck-list li').nth(0));
    await page.waitForTimeout(500);
    const after = await page.$$eval('.deck-name span:last-child', (els) => els.map((e) => e.textContent));
    return { before, after, moved: before.join() !== after.join() };
  });

  await step('undo', async () => {
    const label = await page.locator('.topbar button').filter({ hasText: /^Undo/ }).textContent();
    await page.locator('.topbar button').filter({ hasText: /^Undo/ }).click();
    await page.waitForTimeout(400);
    const after = await page.$$eval('.deck-name span:last-child', (els) => els.map((e) => e.textContent));
    return { label, after };
  });

  await step('export pdf', async () => {
    await page.getByRole('button', { name: /Export print sheet/ }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.getByRole('button', { name: 'Export PDF' }).click(),
    ]);
    const file = path.join(outDir, `${engine}-${download.suggestedFilename()}`);
    await download.saveAs(file);
    const bytes = fs.readFileSync(file);
    const doc = await PDFDocument.load(bytes);
    return { file: path.basename(file), bytes: bytes.length, pages: doc.getPageCount(), width: doc.getPage(0).getWidth(), fonts: (bytes.toString('latin1').match(/\/FontFile/g) || []).length };
  });

  await step('export json', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.getByRole('button', { name: 'Export deck (JSON)' }).click(),
    ]);
    const file = path.join(outDir, `${engine}-${download.suggestedFilename()}`);
    await download.saveAs(file);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { file: path.basename(file), cards: parsed.cards.length, images: Object.keys(parsed.images).length, name: parsed.name };
  });

  await step('reload keeps data', async () => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.deck-list li', { timeout: 20000 });
    await page.waitForFunction(() => !document.querySelector('.preview-toolbar .badge.muted'), null, { timeout: 20000 });
    return await page.$$eval('.deck-name span:last-child', (els) => els.map((e) => e.textContent));
  });

  await page.screenshot({ path: path.join(outDir, `${engine}.png`), fullPage: false });
  await browser.close();
  return report;
}

(async () => {
  const reports = [];
  for (const engine of engines) reports.push(await run(engine));
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports, null, 2));
  console.log(`files in ${outDir}`);
  const failed = reports.some((r) => r.pageErrors.length || Object.values(r.steps).some((v) => typeof v === 'string' && v.startsWith('FAIL')));
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
