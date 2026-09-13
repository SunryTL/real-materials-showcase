import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const skip = !existsSync(executablePath);
let browser, server, origin;
before(async () => { if (skip) return; server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } }); origin = `http://127.0.0.1:${server.httpServer.address().port}`; browser = await chromium.launch({ executablePath, headless: true }); });
after(async () => { await browser?.close(); await new Promise(resolve => server ? server.httpServer.close(resolve) : resolve()); });
const record = { sample_id: 'REAL-1', doi: '10.1234/example', family: 'YAG', plot_family: 'YAG', formula: 'Y3Al5O12:Ce', material_form: 'ceramic', emission_nm: 550, available_fields: 2, total_fields: 4, coverage_fraction: 0.5, coincident_count: 1, status: 'formal', PC1: 1, PC2: 2, PC3: 3 };
const fixture = { version: 'fixture-v1', scope: { family: '', material_form: '', status: 'formal' }, options: { families: ['YAG','LuAG'], material_forms: ['ceramic'], versions: ['fixture-v1'] }, summary: { samples: 1, doi: 1, families: 1, projected: 1 }, records: [record], points: [record], axes: ['PC1','PC2','PC3'].map(key => ({ key, min: 0, max: 3, explained_variance_ratio: 0.3, top_loadings: [] })), family_colors: { YAG: '#4e86af' }, charts: { emission: { grid: [500,550,600], groups: [{ name: 'YAG', color: '#4e86af', n: 1, median: 550, min: 550, max: 550, density: [0,1,0], points: [{ sample_id: 'REAL-1', x: 550 }] }], histogram: [], ecdf: [] }, relationship: { x_label: 'PC1', y_label: 'Emission (nm)', points: [{ sample_id: 'REAL-1', x: 1, y: 550, family: 'YAG', color: '#4e86af' }], x_grid: [0,1,2], y_grid: [500,550,600], groups: [{ family: 'YAG', color: '#4e86af', density_x: [0,1,0], density_y: [0,1,0] }] }, quality: { fields: ['composition','PL'], rows: [{ sample_id:'REAL-1', family:'YAG', available:[true,true] }], coverage: [{field:'PL',count:1,total:1}], sources: [{source:'literature',count:1}] }, evidence: {families:[{family:'YAG',samples:1,doi:1,series:1}], papers:[{doi:record.doi,samples:1}]}, correlation:{labels:['PL','field'],values:[{i:0,j:1,r:0.5,n:1}]}, readiness:[{model:'M0',ready:1,total:1}] } };
async function open(t, respond) {
 const page = await browser.newPage(); t.after(() => page.close()); const queries = [];
 const health = {version:'fixture-v1', metrics:{}, family_counts:[], descriptor_coverage:[],model_readiness:[],candidate_packages:0};
 await page.route('**/api/v1/**', async route => { const url = new URL(route.request().url()); const path=url.pathname; let body;
 if(path==='/api/v1/explorer'){queries.push(url.searchParams); const answer=await respond?.(url); if(answer) return route.fulfill(answer); body=fixture;}
 else body = {'/api/v1/session/me':{id:1,username:'fixture',role:'contributor',display_name:'Fixture'},'/api/v1/dashboard':{documents:{},database:health,jobs:[],weekly:{lee_tasks:[]}},'/api/v1/database/health':health,'/api/v1/documents':{items:[]},'/api/v1/literature/priorities':{items:[],rule:''},'/api/v1/health':{},'/api/v1/figures/releases/latest':{detail:'No archive'}}[path];
 return route.fulfill({status:path.includes('figures/releases')?404:200,contentType:'application/json',body:JSON.stringify(body)});
 }); await page.goto(`${origin}/real-materials-showcase/workbench#database`); return {page,queries};
}
test('explorer shares filter scope, exposes records and exports actual current rows', {skip}, async t=>{
 const {page,queries}=await open(t); await page.getByRole('tab',{name:'数据里有什么'}).waitFor();
 await page.getByLabel('材料家族',{exact:true}).selectOption('YAG'); await page.waitForFunction(()=>document.querySelector('.science-explorer')?.getAttribute('aria-busy')==='false');
 assert.ok(queries.some(q=>q.get('family')==='YAG' && q.get('status')==='formal'));
 await page.locator('.science-records > summary').click(); await page.getByRole('button',{name:'查看样品 REAL-1'}).click(); await page.getByRole('heading',{name:'REAL-1',exact:true}).waitFor(); assert.equal(await page.getByRole('link',{name:'10.1234/example',exact:true}).count(),1);
 await page.getByRole('button',{name:'关闭样品详情'}).click();
 const download=page.waitForEvent('download'); await page.getByRole('button',{name:'导出当前样品 CSV'}).click(); const file=await download; assert.match(file.suggestedFilename(),/fixture-v1/);
 await page.getByRole('tab',{name:'数据质量如何'}).click(); await page.getByRole('img',{name:'字段完整度矩阵'}).waitFor();
 await page.getByRole('tab',{name:'数据能支持什么'}).click(); await page.getByRole('img',{name:'独立证据分布'}).waitFor();
});
test('explorer failure has explicit retry and no invented plot points', {skip},async t=>{
 let fail=true; const {page}=await open(t,()=>fail?{status:503,contentType:'application/json',body:JSON.stringify({detail:'Fixture unavailable'})}:undefined);
 await page.getByText('Fixture unavailable',{exact:true}).waitFor(); assert.equal(await page.locator('.science-chart canvas').count(),0); fail=false;
 await page.getByRole('button',{name:'重试加载'}).click(); await page.getByRole('img',{name:'发射波长分布'}).waitFor();
});
test('high resolution export redraws the active 2D plot at 4200 pixels', {skip},async t=>{
 const {page}=await open(t); const button=page.getByRole('button',{name:'下载发射波长分布 PNG'}); await button.waitFor();
 const download=page.waitForEvent('download'); await button.click(); const result=await download; const stream=await result.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const bytes=Buffer.concat(chunks);assert.equal(bytes.readUInt32BE(16),4200);
});
test('desktop primary figure fits a single viewport without anisotropic canvas scaling', {skip},async t=>{
 const {page}=await open(t);await page.setViewportSize({width:1920,height:1080});const canvas=page.getByRole('img',{name:'发射波长分布'});await canvas.waitFor();const box=await canvas.boundingBox();assert.ok(box.height<=520,`plot is too tall: ${box.height}`);assert.ok(box.y+box.height<1080,`plot bottom ${box.y+box.height} exceeds viewport`);const intrinsic=await canvas.evaluate(el=>({width:el.width,height:el.height}));assert.ok(Math.abs(box.width/box.height-intrinsic.width/intrinsic.height)<0.01);
});
test('low-support correlations remain hollow and individual plot statistics export as CSV', {skip},async t=>{
 const {page}=await open(t);await page.getByRole('tab',{name:'数据质量如何'}).click();const chart=page.getByRole('img',{name:'描述符相关性'});await chart.waitFor();const color=await chart.evaluate(canvas=>Array.from(canvas.getContext('2d').getImageData(Math.round(730*canvas.width/1600),Math.round(135*canvas.height/590),1,1).data));assert.deepEqual(color,[255,255,255,255]);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载描述符相关性统计 CSV'}).click();const file=await download;const stream=await file.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const csv=Buffer.concat(chunks).toString('utf8');assert.match(csv,/0.5/);assert.match(csv,/pair/);assert.match(csv,/fixture-v1/);
});
test('table selection visibly marks the existing 3D scene without recreating its camera', {skip},async t=>{
 const {page}=await open(t);const cloud=page.getByRole('img',{name:'可旋转三维材料点云'});await cloud.waitFor();const before=await cloud.evaluate(canvas=>{canvas.dataset.sceneIdentity='preserved';return canvas.toDataURL();});await page.locator('.science-records > summary').click();await page.getByRole('button',{name:'查看样品 REAL-1'}).click();await page.waitForFunction(previous=>document.querySelector('.science-webgl canvas')?.toDataURL()!==previous,before);assert.equal(await cloud.getAttribute('data-scene-identity'),'preserved');
});
