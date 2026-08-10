import test from "node:test";
import assert from "node:assert/strict";

import { evaluateReadiness } from "../lib/readiness.mjs";

test("empty input returns validation pending without a prediction", () => {
  const result = evaluateReadiness({});
  assert.equal(result.status, "validation_pending");
  assert.equal(result.prediction, null);
  assert.deepEqual(result.missing, ["hostComposition", "activator", "sampleForm"]);
});

test("composition-only input maps to the M0 route", () => {
  const result = evaluateReadiness({
    hostComposition: "Y3Al5O12",
    activator: "Ce3+",
    sampleForm: "transparent_ceramic",
  });
  assert.equal(result.route, "M0");
  assert.equal(result.completeness, 50);
  assert.equal(result.prediction, null);
});

test("structure information upgrades the preview route to M1", () => {
  const result = evaluateReadiness({
    hostComposition: "Lu3Al5O12",
    activator: "Ce3+",
    sampleForm: "phosphor_ceramic",
    latticeA: "11.9",
    localStructure: "AO8 available",
    thickness: "1.0",
  });
  assert.equal(result.route, "M1");
  assert.equal(result.completeness, 100);
  assert.equal(result.status, "validation_pending");
});

