import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
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
    const response = await state.respond?.(path, route.request());
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

test("training influence displays cross-task tradeoffs and opens human review", { skip: !canRunBrowser }, async (t) => {
  const effect=(delta,n)=>({baseline_mae:4,removed_mae:4+delta,delta_mae:delta,n,improved_partitions:delta<0?3:0,refitted_folds:12});
  const review={counts:{records:2,pl:2,ple:2,paired:2,partitions:3},families:[],metrics:{pl_mae_nm:4,family_macro_pl_mae_nm:4},provenance:{},decisions:[],training_influence_available:true,samples:[
    {sample_id:'HELPFUL',family:'YAl',doi:'',pl:true,ple:true,paired:true,pl_mae_nm:20,loss_mae_mev:30,training_influence:{emission:effect(.259,1),excitation:effect(.5,1),loss:effect(.2,1)}},
    {sample_id:'TRADEOFF',family:'LuAl',doi:'',pl:true,ple:true,paired:true,pl_mae_nm:10,loss_mae_mev:20,training_influence:{emission:effect(-.213,1),excitation:effect(.757,1),loss:effect(-.12,1)}}]};
  const {page}=await openDatabase(t,{respond:async path=>path==='/api/v1/database/model-review'?{status:200,body:JSON.stringify(review)}:undefined});
  await page.getByText('训练影响：暂时不用这条记录会怎样？',{exact:true}).click({timeout:3000});
  const panel=page.locator('.review-influence');
  assert.match(await panel.innerText(),/-0.213/);
  assert.match(await panel.innerText(),/\+0.757/);
  assert.match(await panel.innerText(),/\+0.259/);
  assert.equal(await panel.locator('tbody tr').first().locator('th').innerText(),'TRADEOFF');
  await page.getByRole('button',{name:'从训练影响审核 HELPFUL',exact:true}).click();
  await page.getByRole('heading',{name:'审核：HELPFUL',exact:true}).waitFor();
  await page.getByLabel('搜索样品编号或DOI').fill('TRADEOFF');
  assert.equal(await panel.locator('tbody tr').count(),1);
});

test("local parameter form starts a run and displays task-specific results", { skip: !canRunBrowser }, async (t) => {
  let submitted;
  const job={id:'run-test',status:'completed',parameters:{length:2},completed_folds:15,total_folds:15,summary:[{task:'emission',n:78,mae:4.554,rmse:7.558,r2:.855},{task:'excitation',n:30,mae:15.410,rmse:27.425,r2:.728}]};
  const {page}=await openDatabase(t,{respond:async (path,request)=>{
    if(path==='/api/v1/database/model-runs') {
      if(request.method()==='POST'){submitted=request.postDataJSON();return {status:200,body:JSON.stringify(job)};}
      return {status:200,body:JSON.stringify({configured:true,parameters:{
        length:{default:1.5,min:.1,max:10,label:'材料相似性尺度',help:'越大，越倾向于平滑的组成变化。'},
        noise:{default:.02,min:.001,max:.2,label:'观测噪声（eV）',help:'控制对光谱标签的信任程度，不是实测误差。'},
        loss_interaction:{default:.5,min:0,max:1,label:'损失分支交互强度',help:'0为加性关系，越大越强调特征模块共同作用。'},
        correction_amplitude:{default:.1,min:0,max:.3,label:'陶瓷修正幅度（eV）',help:'0关闭条件修正；数值越大，允许的修正越强。'},
        domain_sd:{default:.05,min:0,max:.3,label:'粉体来源差异（eV）',help:'表达辅助粉体与陶瓷之间的来源偏移。'},
      },runs:[]})};
    }
  }});
  await page.getByLabel('材料相似性尺度',{exact:true}).fill('2',{timeout:3000});
  await page.getByRole('button',{name:'运行一次对照训练'}).click();
  await page.getByText('4.554',{exact:true}).waitFor();
  assert.deepEqual(submitted,{parameters:{length:2,noise:.02,loss_interaction:.5,correction_amplitude:.1,domain_sd:.05}});
  assert.match(await page.locator('.model-training').innerText(),/激发能.*meV/s);
  await page.getByRole('button',{name:'恢复原模型参数'}).click();
  assert.equal(await page.getByLabel('材料相似性尺度',{exact:true}).inputValue(),'1.5');
  if(process.env.REAL_UI_QA_DIR){
    mkdirSync(process.env.REAL_UI_QA_DIR,{recursive:true});
    await page.locator('.model-training').screenshot({path:`${process.env.REAL_UI_QA_DIR}/training-desktop.png`});
    await page.setViewportSize({width:390,height:844});
    await page.locator('.model-training').screenshot({path:`${process.env.REAL_UI_QA_DIR}/training-mobile.png`});
  }
});

test("model review saves a reason and displays the saved history", { skip: !canRunBrowser }, async (t) => {
  const sample={sample_id:'REVIEW-A',family:'Y / Al',doi:'10/example',pl:true,ple:false,paired:false,pl_mae_nm:8,loss_mae_mev:null,observed_labels:{pl_peak_nm:550,excitation_ev:null,net_loss_ev:null}};
  const data={counts:{records:1,pl:1,ple:0,paired:0},metrics:{pl_mae_nm:8,family_macro_pl_mae_nm:8},families:[{family:'Y / Al',records:1,compositions:1,sources:1,pl:1,ple:0,paired:0}],samples:[sample],provenance:{samples_sha256:'s',predictions_sha256:'p'},decisions:[]};
  const {page}=await openDatabase(t,{respond:async path=>{
    if(path==='/api/v1/database/model-review')return {status:200,body:JSON.stringify(data)};
    if(path==='/api/v1/database/model-review/decisions')return {status:200,body:JSON.stringify({record:{id:'review-1',sample_id:'REVIEW-A',decision:'check',reason:'原文峰位待核对',provenance:data.provenance,created_at:'2026-10-18'},authority_database_changed:false})};
  }});
  await page.getByRole('button',{name:'审核 REVIEW-A'}).click({timeout:3000});
  await page.getByText('补库目标与缺口试算',{exact:true}).click();
  await page.getByLabel('每体系目标组成数').fill('6');
  assert.match(await page.locator('.supplement-plan tbody').innerText(),/还缺5种/);
  assert.match(await page.locator('.review-form').innerText(),/550.00 nm/);
  assert.match(await page.locator('.review-form').innerText(),/本轮未使用/);
  await page.getByLabel('审核决定').selectOption('check');
  await page.getByLabel('审核理由').fill('原文峰位待核对');
  await page.getByRole('button',{name:'保存审核意见'}).click();
  await page.getByText('已保存审核意见；原始数据未修改。',{exact:true}).waitFor();
  assert.match(await page.locator('.review-history').innerText(),/原文峰位待核对/);
});

test("sample correction sends explicit values and evidence and shows the proposal", { skip: !canRunBrowser }, async (t) => {
  const correction={field:'pl_peak_nm',old_value:550,new_value:552,unit:'nm',evidence:'正文图3b'};
  const data={counts:{records:1,pl:1,ple:0,paired:0},metrics:{pl_mae_nm:8,family_macro_pl_mae_nm:8},families:[],samples:[{sample_id:'A',family:'Y / Al',doi:'10/example',pl:true,ple:false,paired:false,pl_mae_nm:8,loss_mae_mev:null}],provenance:{samples_sha256:'s',predictions_sha256:'p'},decisions:[]};
  const {page}=await openDatabase(t,{respond:async path=>{
    if(path==='/api/v1/database/model-review')return {status:200,body:JSON.stringify(data)};
    if(path==='/api/v1/database/model-review/decisions')return {status:200,body:JSON.stringify({record:{id:'c1',sample_id:'A',decision:'propose_correction',reason:'重新读图',correction,created_at:'2026-10-18'}})};
    if(path==='/api/v1/database/model-review/candidate')return {status:200,body:JSON.stringify({status:'candidate_not_applied',changes:[{id:'c1',correction}]})};
    if(path==='/api/v1/database/model-runs')return {status:200,body:JSON.stringify({id:'candidate-run',configured:true,parameters:{},runs:[]})};
  }});
  await page.getByRole('button',{name:'审核 A',exact:true}).click({timeout:3000});
  await page.getByLabel('审核决定').selectOption('propose_correction');
  await page.getByLabel('修改字段').selectOption('pl_peak_nm');
  await page.getByLabel('原值（手动核对，可留空）').fill('550');
  await page.getByLabel('建议新值').fill('552');
  await page.getByLabel('原文依据').fill('正文图3b');
  await page.getByLabel('审核理由').fill('重新读图');
  const request=page.waitForRequest(r=>r.url().endsWith('/model-review/decisions') && r.method()==='POST');
  await page.getByRole('button',{name:'保存审核意见'}).click();
  assert.deepEqual((await request).postDataJSON().correction,correction);
  await page.getByText('已保存审核意见；原始数据未修改。',{exact:true}).waitFor();
  assert.match(await page.locator('.review-history').innerText(),/550 → 552 nm/);
  assert.match(await page.locator('.review-history').innerText(),/正文图3b/);
  const download=page.waitForEvent('download');
  const exportRequest=page.waitForRequest(r=>r.url().endsWith('/model-review/candidate'));
  await page.getByRole('button',{name:'导出候选修改 A'}).click();
  assert.deepEqual((await exportRequest).postDataJSON(),{decision_ids:['c1']});
  assert.match((await download).suggestedFilename(),/^REAL-candidate-.*\.json$/);
  const trainingRequest=page.waitForRequest(r=>r.url().endsWith('/model-runs') && r.method()==='POST');
  await page.getByRole('button',{name:'按默认参数重训候选修改 A'}).click({timeout:3000});
  assert.deepEqual((await trainingRequest).postDataJSON(),{parameters:{},candidate_decision_ids:['c1']});
  await page.getByText('候选修改训练已启动，请在下方运行记录查看进度。',{exact:true}).waitFor();
  await page.getByRole('button',{name:'审核 A',exact:true}).click();
  await page.getByLabel('审核决定').selectOption('propose_correction');
  assert.equal(await page.getByLabel('建议新值').inputValue(),'');
  assert.equal(await page.getByLabel('原文依据').inputValue(),'');
});

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
