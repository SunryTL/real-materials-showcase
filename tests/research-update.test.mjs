import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test, before, after } from 'node:test';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
const skip = !existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
let browser, server, origin;
before(async()=>{if(skip)return;server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});origin=`http://127.0.0.1:${server.httpServer.address().port}/real-materials-showcase/`;browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});});
after(async()=>{await browser?.close();await new Promise(r=>server?server.httpServer.close(r):r());});
test('reviewed version retains sample selection and the full library stays available',{skip},async()=>{
 const p=await browser.newPage();try{
 await p.goto(origin+'#database');await p.getByText(/255 个样品 · 42 个 DOI/).waitFor();
 await p.locator('.science-explorer[aria-busy="false"]').waitFor();
 const select=p.locator('.science-version-select select');
 assert.ok(await select.locator('option[value="pl92_20261026_v1"]').count(),'reviewed version must be available');
 await select.selectOption('pl92_20261026_v1');await p.getByText(/92 个样品/).first().waitFor();
 await p.locator('.science-records summary').click();await p.locator('.science-records tbody button').first().click();
 assert.ok(await p.locator('.science-record-drawer a[href^="https://doi.org/"]').count());
 await p.getByRole('button',{name:'关闭样品详情'}).click();await select.selectOption('latest');await p.getByText(/255 个样品 · 42 个 DOI/).waitFor();
 }finally{await p.close();}
});
