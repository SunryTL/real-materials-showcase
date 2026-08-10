declare module "../lib/readiness.mjs" {
  export type ReadinessInput = Record<string, string>;
  export type ReadinessResult = {
    status: "validation_pending";
    prediction: null;
    uncertainty: null;
    applicabilityDomain: null;
    route: "M0" | "M1";
    completeness: number;
    missing: string[];
  };
  export function evaluateReadiness(input: ReadinessInput): ReadinessResult;
}
