import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production build contains REAL metadata and entrypoint", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /REAL 材料预测平台/);
  assert.match(html, /assets\/index-[^\"]+\.js/);
  assert.match(html, /assets\/index-[^\"]+\.css/);
});
