export function evaluateReadiness(input: Record<string, unknown>): {
  status: 'validation_pending'; prediction: null; uncertainty: null; applicabilityDomain: null;
  route: 'M0' | 'M1'; completeness: number; missing: string[];
};
