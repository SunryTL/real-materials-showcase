import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/workbench/WorkbenchApp.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/real_workbench/app.py", import.meta.url), "utf8");

test("private workbench exposes the five requested research surfaces", () => {
  for (const label of ["工作台", "文献处理", "七表审核", "数据库状态", "下一批文献"]) {
    assert.match(source, new RegExp(label));
  }
});

test("private API includes upload, extraction, package review and database health", () => {
  for (const path of [
    "/api/v1/documents",
    "/api/v1/documents/{document_id}/extract",
    "/api/v1/packages/{job_id}",
    "/api/v1/database/health",
  ]) {
    assert.ok(api.includes(path));
  }
});

test("workbench communicates the candidate-only authority boundary", () => {
  assert.match(source, /候选数据/);
  assert.match(source, /不会覆盖权威数据库/);
});

test("weekly figures stay frozen while database figures use a versioned refresh API", () => {
  for (const name of ["01_weekly_data_preparation", "02_literature_distillation_workflow"]) {
    assert.match(source, new RegExp(name));
    assert.equal(existsSync(new URL(`../public/workbench/figures/${name}.png`, import.meta.url)), true);
  }
  for (const path of [
    "/api/v1/figures/render",
    "/api/v1/figures/jobs/{job_id}",
    "/api/v1/figures/releases/latest",
  ]) assert.ok(api.includes(path));
  assert.match(source, /刷新数据库科研图/);
  assert.match(source, /统计CSV/);
});
