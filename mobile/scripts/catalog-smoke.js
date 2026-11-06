// Opens the generated 3D catalog in headless Chromium, with sample data and with an empty catalog,
// and fails on any console/page error. Usage: node scripts/catalog-smoke.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const file = fs.readFileSync(path.join(__dirname, '..', 'src', 'catalog', 'catalogHtml.ts'), 'utf8');
const html = JSON.parse(file.slice(file.indexOf('= ') + 2, file.lastIndexOf(';')));

const row = (name, h) => [name, name, h, ['show', 'photo'], ['Показы, Фотосъёмки', 'Podium'], ['Надёжная модель', 'Ishonchli'], []];
const SAMPLE = { W: [row('Test Girl', 170), row('Second Girl', 175)], M: [row('Test Guy', 185)], RW: [10, 9], RM: [9] };
const EMPTY = { W: [], M: [], RW: [], RM: [] };

async function run(browser, label, data) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(`window.ZAYA_CATALOG=${JSON.stringify(data)};`);
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url === 'https://zaya.local/') return route.fulfill({ contentType: 'text/html', body: html });
    if (/three(\.min)?\.js/.test(url) && process.env.THREE_JS) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.THREE_JS) });
    return route.continue();
  });
  await page.goto('https://zaya.local/');
  await page.waitForTimeout(3000);
  const skip = page.locator('#skip');
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.waitForTimeout(4000);
  const canvases = await page.locator('canvas').count();
  const threeLoaded = await page.evaluate(() => typeof THREE !== 'undefined');
  const counter = await page.evaluate(() => (document.getElementById('count') || {}).textContent || '');
  if (!threeLoaded) errors.push('three.js did not load');
  if (!counter.trim()) errors.push('the page counter is empty, the book did not initialise');
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${label.replace(/\W+/g, '_')}.png` });
  await page.close();
  if (canvases < 1) errors.push('no canvas on the page');
  console.log(`${label}: canvases=${canvases} three=${threeLoaded} counter="${counter.trim()}" errors=${errors.length}`);
  errors.forEach((e) => console.log('  - ' + e));
  return errors.length === 0;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const a = await run(browser, 'sample data', SAMPLE);
  const b = await run(browser, 'empty catalog', EMPTY);
  await browser.close();
  process.exit(a && b ? 0 : 1);
})();
