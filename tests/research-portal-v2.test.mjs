import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const skip = !existsSync(executablePath);
let browser, server, origin;

before(async () => {
  if (skip) return;
  server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
});

after(async () => {
  await browser?.close();
  await new Promise(resolve => server ? server.httpServer.close(resolve) : resolve());
});

test('public REAL tells the research story and exposes the four durable surfaces', { skip }, async t => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  t.after(() => page.close());
  await page.goto(`${origin}/real-materials-showcase/#home`);
  await page.locator('.real-hero h1').waitFor();
  assert.match(await page.locator('.real-hero h1').innerText(), /REAL Predictions.*Real Light/s);
  assert.equal(await page.locator('.wb-sidebar').count(), 0);
  await page.getByRole('heading', { name: /REAL Predictions.*Real Light/ }).waitFor();
  await page.getByText('真实预测，真切发光', { exact: true }).waitFor();
  await page.getByText('Vinča Institute of Nuclear Sciences – National Institute of the Republic of Serbia, University of Belgrade', { exact: true }).waitFor();
  for (const label of ['首页', '合作研究', '数据录入', '文献整理', '数据库']) {
    assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 1);
  }
  await page.getByRole('button', { name: '文献整理', exact: true }).click();
  await page.getByRole('heading', { name: /已整理文献与下一批证据/ }).waitFor();
  await page.getByText('10.1111/jace.20497', { exact: true }).waitFor();
});

test('public intake is honest about local operation and still exposes current records', { skip }, async t => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  t.after(() => page.close());
  await page.goto(`${origin}/real-materials-showcase/#intake`);
  await page.getByRole('heading', { name: /论文与候选表进入同一审核链/ }).waitFor();
  assert.equal(await page.locator('input[type=file]').count(), 0);
  await page.getByText(/公开页面不接收PDF/).waitFor();
  await page.getByRole('table', { name: '当前正式数据库预览' }).waitFor();
});

test('institutional header links Vinča after Belgrade and fits desktop and mobile', { skip }, async t => {
  const page = await browser.newPage();
  t.after(() => page.close());
  for (const width of [1920, 1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/real-materials-showcase/#home`);
    const marks = page.locator('.real-university-marks a');
    assert.deepEqual(await marks.evaluateAll(links => links.map(link => link.href)), ['https://www.jsnu.edu.cn/', 'https://www.bg.ac.rs/', 'https://vin.bg.ac.rs/en/']);
    await page.waitForFunction(() => [...document.querySelectorAll('.real-university-marks img')].every(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
    assert.equal(await page.locator('.real-header-inner').evaluate(el => [...el.children].filter(c => getComputedStyle(c).display !== 'none').every(c => c.getBoundingClientRect().right <= innerWidth)), true);
  }
});

test('legacy public workbench URL canonicalizes to the single root entry', { skip }, async t => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());
  await page.goto(`${origin}/real-materials-showcase/workbench?mode=public#home`);
  await page.locator('.real-hero h1').waitFor();
  const url = new URL(page.url());
  assert.equal(url.pathname, '/real-materials-showcase/');
  assert.equal(url.search, '');
  assert.equal(url.hash, '#home');
});

test('point cloud exposes evidence galaxy and PCA modes without inventing random topology', () => {
  const source = readFileSync(new URL('../src/workbench/ScientificPointCloud.tsx', import.meta.url), 'utf8');
  assert.match(source, /ShaderMaterial/);
  assert.match(source, /证据星系/);
  assert.match(source, /PCA化学空间/);
  assert.match(source, /buildEvidenceGalaxy/);
  assert.match(source, /UnrealBloomPass/);
  assert.doesNotMatch(source, /Math\.random/);
});

test('top navigation supports history, cooperation anchors and the mobile menu', { skip }, async t => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  t.after(() => page.close());
  await page.goto(`${origin}/real-materials-showcase/#home`);
  await page.getByRole('button', { name: '打开导航', exact: true }).click();
  await page.getByRole('button', { name: '合作研究', exact: true }).click();
  assert.equal(new URL(page.url()).hash, '#cooperation');
  await page.waitForFunction(() => document.querySelector('#cooperation').getBoundingClientRect().top < 150);
  await page.getByRole('button', { name: '打开导航', exact: true }).click();
  await page.getByRole('button', { name: '文献整理', exact: true }).click();
  await page.getByRole('heading', { name: /已整理文献与下一批证据/ }).waitFor();
  await page.goBack();
  await page.locator('.real-hero h1').waitFor();
  await page.goForward();
  await page.getByRole('heading', { name: /已整理文献与下一批证据/ }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: /已整理文献与下一批证据/ }).waitFor();
  await page.getByRole('link', { name: '跳到正文' }).focus();
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash, '#literature');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
});
