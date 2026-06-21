export const PHASE_WEIGHTS = {
  REQUIREMENTS: 0.15,
  DESIGN: 0.2,
  IMPLEMENTATION: 0.3,
  TESTING: 0.15,
  DEPLOYMENT: 0.2,
  MAINTENANCE: 0,
};

export const REQUIRED_WEIGHTED_PHASES = Object.entries(PHASE_WEIGHTS)
  .filter(([, weight]) => weight > 0)
  .map(([phase]) => phase);

export function calculateWeightedFinal(phaseAverages = {}) {
  let weightedTotal = 0;
  let usedWeights = 0;

  Object.entries(phaseAverages).forEach(([phase, avg]) => {
    const weight = PHASE_WEIGHTS[phase] ?? 0;
    if (weight <= 0 || avg === null || avg === undefined) return;
    weightedTotal += weight * Number(avg);
    usedWeights += weight;
  });

  const missingWeightedPhases = REQUIRED_WEIGHTED_PHASES.filter(
    (phase) => phaseAverages[phase] === undefined || phaseAverages[phase] === null,
  );

  return {
    weightedFinal: usedWeights > 0 ? Math.round(weightedTotal / usedWeights) : null,
    missingWeightedPhases,
    isFinalComplete: missingWeightedPhases.length === 0,
  };
}
