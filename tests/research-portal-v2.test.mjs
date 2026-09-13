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
  await page.goto(`${origin}/real-materials-showcase/workbench?mode=public#home`);
  await page.locator('.portal-hero h2').waitFor();
  assert.match(await page.locator('.portal-hero h2').innerText(), /把文献证据变成.*可检验的发射预测/s);
  for (const label of ['首页', '数据录入', '文献整理', '数据库状态']) {
    assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 1);
  }
  await page.getByRole('button', { name: '文献整理', exact: true }).click();
  await page.getByRole('heading', { name: /已整理文献与下一批证据/ }).waitFor();
  await page.getByText('10.1111/jace.20497', { exact: true }).waitFor();
});

test('public intake is honest about local operation and still exposes current records', { skip }, async t => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  t.after(() => page.close());
  await page.goto(`${origin}/real-materials-showcase/workbench?mode=public#intake`);
  await page.getByRole('heading', { name: /论文与候选表进入同一审核链/ }).waitFor();
  assert.equal(await page.locator('input[type=file]').count(), 0);
  await page.getByText(/公开页面不接收PDF/).waitFor();
  await page.getByRole('table', { name: '当前正式数据库预览' }).waitFor();
});

test('point cloud uses the enhanced shader contract without changing its one-point-per-record invariant', () => {
  const source = readFileSync(new URL('../src/workbench/ScientificPointCloud.tsx', import.meta.url), 'utf8');
  assert.match(source, /ShaderMaterial/);
  assert.match(source, /one observation per vertex/i);
  assert.match(source, /projection plane/i);
  assert.doesNotMatch(source, /Math\.random/);
});
