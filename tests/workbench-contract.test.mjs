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

test("publication figures are exposed as high-resolution raster assets", () => {
  for (const name of [
    "01_weekly_data_preparation",
    "02_literature_distillation_workflow",
    "03_database_landscape",
    "04_m0_diagnostics",
    "07_evidence_topology",
    "08_emission_landscape",
  ]) {
    assert.match(source, new RegExp(name));
    assert.equal(existsSync(new URL(`../public/workbench/figures/${name}.png`, import.meta.url)), true);
  }
});
