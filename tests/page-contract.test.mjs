import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("platform page exposes the five research product surfaces", async () => {
  const page = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  for (const label of ["数据探索", "机制解析", "预测实验室", "研究证据", "版本路线"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /模型正在进行严格分组验证，暂不提供数值预测/);
});

test("site metadata names REAL instead of the starter", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /REAL 材料预测平台/);
  assert.doesNotMatch(html, /Starter Project/);
});
