const REQUIRED_FIELDS = ["hostComposition", "activator", "sampleForm"];
const OPTIONAL_FIELDS = ["latticeA", "localStructure", "thickness"];

export function evaluateReadiness(input) {
  const missing = REQUIRED_FIELDS.filter((field) => !String(input[field] ?? "").trim());
  const completedRequired = REQUIRED_FIELDS.length - missing.length;
  const completedOptional = OPTIONAL_FIELDS.filter((field) => String(input[field] ?? "").trim()).length;
  const completed = completedRequired + completedOptional;
  const completeness = Math.round((completed / (REQUIRED_FIELDS.length + OPTIONAL_FIELDS.length)) * 100);
  const route = completedOptional >= 2 && missing.length === 0 ? "M1" : "M0";
  return {
    status: "validation_pending",
    prediction: null,
    uncertainty: null,
    applicabilityDomain: null,
    route,
    completeness,
    missing,
  };
}

