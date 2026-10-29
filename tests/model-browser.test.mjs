import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test, before, after } from 'node:test';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
const artifact=()=>JSON.parse(readFileSync(new URL('../public/workbench/public-data/research-20261029.json',import.meta.url),'utf8'));
test('six algorithm results retain unique OOF keys, energy identity and source-sample links',()=>{
 const d=artifact();assert.equal(d.metrics.length,6);assert.equal(d.predictions.length,1656);
 const ids=new Set(d.records.map(r=>r.sample_id));const keys=new Set();
 for(const p of d.predictions){assert.ok(ids.has(p.sample_id));const key=[p.route,p.seed,p.sample_id].join('|');assert.ok(!keys.has(key));keys.add(key);assert.ok(Math.abs(p.excitation_ev-p.latent_loss_ev+p.correction_ev-p.emission_ev)<1e-10);assert.ok(Math.abs(1239.841984/p.emission_ev-p.predicted_nm)<1e-8);}
 for(const r of d.records){assert.equal(Object.keys(r.conditions).length,5);assert.ok(Object.values(r.conditions).every(v=>v===null||Number.isFinite(v)));}
});
const path=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const skip=!existsSync(path);
let browser,server,origin;
before(async()=>{if(skip)return;server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});origin=`http://127.0.0.1:${server.httpServer.address().port}/real-materials-showcase/`;browser=await chromium.launch({executablePath:path,headless:true});});
after(async()=>{await browser?.close();await new Promise(r=>server?server.httpServer.close(r):r());});
test('independent model page links recorded inputs to six algorithms and physical outputs',{skip},async t=>{
 const p=await browser.newPage({viewport:{width:1440,height:1000}});t.after(()=>p.close());await p.goto(origin+'#models');
 await p.getByRole('heading',{name:'机器学习模型',exact:true}).waitFor();
 await p.getByLabel('具体样品',{exact:true}).waitFor();
 const d=artifact();const r=d.records.find(r=>r.sample_id==='BARTA21_YAG');
 await p.getByLabel('具体样品',{exact:true}).selectOption(r.sample_id);
 assert.ok((await p.locator('.model-input-evidence').innerText()).includes('未记录'));
 await p.getByLabel('模型算法',{exact:true}).selectOption('joint_svr');await p.getByLabel('验证重复',{exact:true}).selectOption('20260919');
 const expected=d.predictions.find(x=>x.sample_id===r.sample_id&&x.route==='joint_svr'&&x.seed===20260919);
 assert.equal(await p.locator('[data-result="predicted"]').innerText(),expected.predicted_nm.toFixed(2));
 assert.equal(await p.locator('[data-energy="c"]').innerText(),expected.correction_ev.toFixed(4));
 assert.equal(await p.locator('.model-source-link').getAttribute('href'),'https://doi.org/'+r.doi);
 await p.getByRole('tab',{name:'模型性能',exact:true}).click();await p.getByLabel('模型算法',{exact:true}).selectOption('joint_gpr');
 assert.ok((await p.locator('.model-performance').innerText()).includes('0.8405'));
 assert.equal(await p.locator('.model-parity circle[role="button"]').count(),92);
 const first=p.locator('.model-parity circle[role="button"]').first();const sid=await first.getAttribute('data-sample');await first.click();
 await p.getByRole('tab',{name:'预测结果',exact:true}).click();assert.equal(await p.getByLabel('具体样品',{exact:true}).inputValue(),sid);
 await p.getByRole('tab',{name:'模型原理',exact:true}).click();await p.getByRole('button',{name:'陶瓷观测修正 c',exact:true}).click();
 assert.ok((await p.locator('.model-branch-detail').innerText()).includes('厚度'));
 assert.doesNotMatch(await p.locator('.model-browser').innerText(),/论文/);
 await p.getByRole('button',{name:'数据库',exact:true}).click();await p.locator('.science-explorer[aria-busy="false"]').waitFor();assert.equal(await p.getByRole('tab',{name:'模型与论文'}).count(),0);
 await p.goBack();await p.getByLabel('具体样品',{exact:true}).waitFor();await p.reload();await p.getByLabel('具体样品',{exact:true}).waitFor();
});
test('model browser supports family/formula filtering, mobile navigation and retry',{skip},async t=>{
 const p=await browser.newPage({viewport:{width:390,height:844}});t.after(()=>p.close());let fail=true;
 await p.route('**/research-20261029.json',route=>fail?route.fulfill({status:503,body:'Unavailable'}):route.continue());
 await p.goto(origin+'#models');await p.getByRole('button',{name:'重新加载模型结果'}).waitFor();fail=false;await p.getByRole('button',{name:'重新加载模型结果'}).click();await p.getByLabel('具体样品',{exact:true}).waitFor();
 await p.getByLabel('材料家族',{exact:true}).selectOption('YAG');
 const options=await p.getByLabel('具体样品',{exact:true}).locator('option').evaluateAll(o=>o.map(x=>x.value));
 const d=artifact();assert.ok(options.every(id=>d.records.find(r=>r.sample_id===id).family==='YAG'));
 assert.equal(await p.locator('.model-parity circle[role="button"]').count(),options.length);
 const formula=await p.getByLabel('材料配方',{exact:true}).locator('option').nth(1).getAttribute('value');await p.getByLabel('材料配方',{exact:true}).selectOption(formula);
 assert.equal(new Set(await p.getByLabel('具体样品',{exact:true}).locator('option').evaluateAll(o=>o.map(x=>x.textContent))).size,await p.getByLabel('具体样品',{exact:true}).locator('option').count());
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.getByRole('button',{name:'打开导航',exact:true}).click();await p.getByRole('button',{name:'数据库',exact:true}).click();await p.getByRole('button',{name:'打开导航',exact:true}).click();await p.getByRole('button',{name:'机器学习模型',exact:true}).click();await p.getByLabel('具体样品',{exact:true}).waitFor();
});
