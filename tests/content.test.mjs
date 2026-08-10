import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public statistics use the conservative audited core definition", async () => {
  const content = JSON.parse(await readFile(new URL("../content/project.json", import.meta.url), "utf8"));
  assert.equal(content.metrics.totalSamples, 255);
  assert.equal(content.metrics.coreSamples, 132);
  assert.equal(content.metrics.physicsPairs, 53);
  assert.equal(content.metrics.coreDoi, 27);
  assert.match(content.coreDefinition, /core_dataset_flag/);
});

test("model registry exposes no numeric prediction while validation is pending", async () => {
  const registry = JSON.parse(await readFile(new URL("../content/models.json", import.meta.url), "utf8"));
  assert.equal(registry.status, "validation_pending");
  assert.equal(registry.publicPredictionEnabled, false);
  assert.equal(registry.latestScore, null);
});

