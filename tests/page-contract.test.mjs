import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("root entry renders the audited public research workbench", async () => {
  const entry = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
  assert.match(entry, /<PublicWorkbenchApp/);
  assert.doesNotMatch(entry, /<App\s*\/>/);
});

test("site metadata names REAL instead of the starter", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /REAL科研平台 · 中塞联合研究/);
  assert.doesNotMatch(html, /Starter Project/);
});
