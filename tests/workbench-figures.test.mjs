import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import { preview } from "vite";

const executablePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const canRunBrowser = existsSync(executablePath);
let server;
let browser;
let origin;

before(async () => {
  if (!canRunBrowser) return;
  server = await preview({ preview: { host: "127.0.0.1", port: 0, open: false } });
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server ? server.httpServer.close(resolve) : resolve());
});

const health = {
  version: "database-fixture-v1", audited_on: "2026-09-12",
  metrics: { totalSamples: 255, coreSamples: 132, coreDoi: 27, m0Ready: 131 },
  family_counts: [], descriptor_coverage: [],
  model_readiness: [{ model: "M0", ready: 131, total: 132, status: "fixture readiness" }],
  candidate_packages: 2, authority_write_enabled: false,
};

function release(version) {
  const figure = (id, display_role, title) => ({
    id, display_role, title, path: `${id}.png`, statistics: `${id}.csv`,
    width_px: 3840, height_px: 2160, mode: "snapshot", sha256: `${version}-${id}-sha`,
    phenomenon: "Fixture observation", judgment: "Fixture judgment", next_step: "Fixture next step",
  });
  return {
    database_version: health.version, release_version: version,
    generated_at_utc: "2026-09-12T04:00:00Z", asset_base_url: `/test-figures/${version}`,
    // Deliberately place a detail before the master: array order is not display priority.
    figures: [
      figure("figure_01_emission", "detail", "Emission detail"),
      figure("figure_00_database_master", "master", "Database six-panel master"),
      figure("figure_06_appendix", "appendix", "Evidence appendix"),
    ],
    metrics: health.metrics, source_sha256: { snapshot: "fixture-source-sha" },
  };
}

async function openDatabase(t, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  t.after(() => page.close());
  const state = { release: release("release-one"), role: "owner", ...options };
  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==", "base64");
  await page.route("**/test-figures/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: pixel }));
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const response = await state.respond?.(path);
    if (response) return route.fulfill({ contentType: "application/json", ...response });
    const body = {
      "/api/v1/session/me": { id: 1, username: "fixture", display_name: "Fixture user", role: state.role },
      "/api/v1/dashboard": {
        documents: { unique_pdf: 0, locations: 0, duplicate_groups: 0, ready_for_extraction: 0, candidate_ready: 0 },
        database: health, jobs: [],
        weekly: { external_ce_rt_rows: 0, external_deduplicated_rows: 0, core_samples: 132, exact_hosts: 0, pdf_files: 0, unique_pdfs: 0, duplicate_groups: 0, priority_dois: 0, lee_tasks: [] },
      },
      "/api/v1/documents": { items: [] },
      "/api/v1/database/health": health,
      "/api/v1/literature/priorities": { items: [], rule: "fixture" },
      "/api/v1/health": { openai_configured: false },
      "/api/v1/figures/releases/latest": state.release,
    }[path];
    return route.fulfill({ status: body ? 200 : 404, contentType: "application/json", body: JSON.stringify(body || { detail: "Unknown fixture endpoint" }) });
  });
  await page.goto(`${origin}/real-materials-showcase/workbench#database`);
  await page.getByRole("tab", { name: "数据里有什么" }).waitFor();
  return { page, state };
}

test("database keeps published PNGs supplementary and exposes archive downloads on request", { skip: !canRunBrowser }, async (t) => {
  const { page } = await openDatabase(t);
  const master = page.getByRole("img", { name: "Database six-panel master" });
  assert.equal(await master.isVisible(), false, "archive must not replace the interactive primary view");
  await page.locator('.science-archive > summary').click();
  await master.waitFor();
  const source = await master.getAttribute("src");
  assert.match(source, /figure_00_database_master\.png/);
  assert.match(source, /release=release-one/);
  assert.match(source, /sha=release-one-figure_00_database_master-sha/);
  assert.equal(await page.getByRole("img", { name: "Emission detail" }).isVisible(), true);
  assert.equal(await page.getByRole("img", { name: "Evidence appendix" }).isVisible(), true);
  const stats = page.locator(".wb-atlas-figure").filter({has: master}).getByRole("link", { name: "统计CSV" });
  assert.match(await stats.getAttribute("href"), /release=release-one/);
});

test("a failed refresh retains the published master, and a successful retry replaces it and clears the error", { skip: !canRunBrowser }, async (t) => {
  let attempts = 0;
  let state;
  const opened = await openDatabase(t, {
    respond: async (path) => {
      if (path === "/api/v1/figures/render") {
        attempts += 1;
        return { status: 200, body: JSON.stringify({ job_id: attempts, database_version: health.version }) };
      }
      if (path.startsWith("/api/v1/figures/jobs/")) {
        const failed = attempts === 1;
        if (!failed) state.release = release("release-two");
        return { status: 200, body: JSON.stringify({
          id: attempts, status: failed ? "failed" : "complete", stage: failed ? "render" : "publish",
          progress: failed ? 40 : 100, message: failed ? "生成失败" : "新图集已发布",
          database_version: health.version, ...(failed ? { error_message: "Test renderer unavailable" } : {}),
        }) };
      }
    },
  });
  state = opened.state;
  const page = opened.page;
  await page.locator('.science-archive > summary').click();
  const master = page.getByRole("img", { name: "Database six-panel master" });
  await page.getByRole("button", { name: "刷新数据库科研图" }).click();
  await page.getByText("Test renderer unavailable").waitFor();
  assert.match(await master.getAttribute("src"), /release-one/);
  await page.getByRole("button", { name: "刷新数据库科研图" }).click();
  await page.waitForFunction(() => document.querySelector('img[alt="Database six-panel master"]')?.getAttribute("src")?.includes("release-two"));
  assert.equal(await page.getByText("Test renderer unavailable").count(), 0);
  assert.equal(await page.locator(".wb-inline-message").count(), 0);
});

test("contributors can inspect the master without receiving the owner-only refresh action", { skip: !canRunBrowser }, async (t) => {
  const { page } = await openDatabase(t, { role: "contributor" });
  await page.locator('.science-archive > summary').click();
  assert.equal(await page.getByRole("img", { name: "Database six-panel master" }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "刷新数据库科研图" }).count(), 0);
});
