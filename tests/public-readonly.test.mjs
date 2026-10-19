import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { before, after, test } from 'node:test';
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

test('GitHub Pages mode is read-only, backend-free and renders the audited explorer', { skip }, async t => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  t.after(() => page.close());
  const apiRequests = [];
  page.on('request', request => { if (request.url().includes('/api/v1/')) apiRequests.push(request.url()); });
  await page.goto(`${origin}/real-materials-showcase/#database`);
  await page.getByRole('heading', { name: '数据库状态' }).waitFor();
  await page.getByRole('img', { name: '发射波长分布' }).waitFor();
  await page.getByLabel('材料家族', { exact: true }).selectOption('YAG');
  await page.getByText(/77 个样品 · 13 个 DOI · 1 个家族/).waitFor();
  assert.equal(await page.getByRole('button', { name: /导出当前样品/ }).count(), 0);
  assert.equal(await page.getByText(/当前范围样品表/).count(), 0);
  assert.equal(apiRequests.length, 0);
  assert.equal(await page.locator('input[type=file]').count(), 0);
  await page.getByRole('button', { name: '数据录入' }).click();
  await page.getByRole('button', { name: '复制Codex任务' }).waitFor();
  assert.equal(await page.getByText('启动AI蒸馏', { exact: true }).count(), 0);
});

test('committed public release contains no local path or secret field', () => {
  const root = new URL('../public/workbench/public-data/', import.meta.url);
  const latest = JSON.parse(readFileSync(new URL('latest.json', root), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL(latest.release, root), 'utf8'));
  assert.equal(manifest.mode, 'public-read-only');
  assert.equal(manifest.summary.samples, 255);
  assert.equal(manifest.summary.projected, 131);
  assert.equal(manifest.privacy.contains_local_paths, false);
  assert.equal(manifest.privacy.contains_api_key, false);
  const text = JSON.stringify(manifest);
  assert.doesNotMatch(text, /\/Users\//);
  assert.doesNotMatch(text, /sk-[A-Za-z0-9]/);
  const releaseRoot = new URL(latest.release.replace(/manifest\.json$/, ''), root);
  for (const relative of Object.values(manifest.scopes)) {
    const payload = JSON.parse(readFileSync(new URL(relative, releaseRoot), 'utf8'));
    assert.ok(payload.aggregates, 'public payload must contain aggregate statistics');
    assert.equal('records' in payload, false);
    assert.equal('points' in payload, false);
    assert.doesNotMatch(JSON.stringify(payload), /"(?:sample_id|doi|formula)"\s*:\s*"/);
  }
});

test('production build contains a real GitHub Pages workbench entry', () => {
  assert.equal(existsSync(new URL('../dist/workbench/index.html', import.meta.url)), true);
});

test('public source and build do not ship sample-level archive data', () => {
  for (const folder of ['public', 'dist']) {
    const root = new URL(`../${folder}/`, import.meta.url);
    for (const name of readdirSync(root, { recursive: true })) {
      if (!/\.(json|csv)$/.test(name)) continue;
      const text = readFileSync(new URL(name, root), 'utf8');
      assert.doesNotMatch(text, /"sample_id"\s*:|(?:^|\n)sample_id,/, `${folder}/${name}`);
      assert.doesNotMatch(text, /\/Users\//, `${folder}/${name}`);
    }
  }
});

test('sample-level legacy figures stay outside source and production public assets', () => {
  // These visually audited images contain individual residuals or measured peaks.
  // Restoring either file to public must fail even if no page links to it.
  for (const folder of ['public', 'dist']) {
    for (const name of ['04_m0_diagnostics.png', '08_emission_landscape.png']) {
      assert.equal(existsSync(new URL(`../${folder}/workbench/figures/${name}`, import.meta.url)), false,
        `${folder}/${name} contains sample-level observations`);
    }
  }
});
