/**
 * Gamification Rules Engine
 *
 * Matches GamificationEvents against active GamificationRules
 * and computes the final XP amounts after applying multipliers and caps.
 */

/**
 * Find all active rules that match a given event.
 *
 * @param {object[]} rules       – all active GamificationRule rows
 * @param {object}   event       – the GamificationEvent being processed
 * @returns {object[]}           – subset of rules whose eventType and conditions match
 */
export function matchRules(rules, event) {
  return rules.filter((rule) => {
    if (rule.eventType !== event.eventType) return false;
    if (!matchConditions(rule.conditions, event.payload)) return false;
    return true;
  });
}

/**
 * Check whether a rule's conditions object is satisfied by the event payload.
 * Each key in `conditions` must match the corresponding key in `payload`.
 * An empty/null conditions object matches everything.
 */
function matchConditions(conditions, payload) {
  if (!conditions || typeof conditions !== "object" || Object.keys(conditions).length === 0) {
    return true;
  }
  if (!payload || typeof payload !== "object") return false;

  for (const [key, expected] of Object.entries(conditions)) {
    // Boolean flags must explicitly match the payload's boolean intent.
    if (typeof expected === "boolean") {
      if (payload[key] !== expected) return false;
      continue;
    }
    // Direct value comparison
    if (payload[key] !== expected) return false;
  }
  return true;
}

/**
 * Calculate the final XP amount for a matched rule + event.
 *
 * Formula: baseXp × difficulty × timeliness × evidence × quality
 * Each multiplier category looks up the correct tier from the event payload.
 * Missing multiplier categories default to 1.0.
 *
 * @param {object} rule    – the matched GamificationRule
 * @param {object} payload – the event payload with contextual data
 * @returns {object}       – { amount, breakdown }
 */
export function calculateXp(rule, payload = {}) {
  const base = rule.baseXp ?? 0;
  if (base === 0) {
    return { amount: 0, breakdown: { baseXp: 0 } };
  }

  const multipliers = rule.multipliers ?? {};
  const breakdown = { baseXp: base };

  const effortMult = resolveEffortMultiplier(payload);
  breakdown.effortMultiplier = effortMult;

  // Difficulty multiplier
  const diffMult = resolveMultiplier(multipliers.difficulty, payload.priority ?? payload.difficulty);
  breakdown.difficultyMultiplier = diffMult;

  // Timeliness multiplier
  const timeMult = resolveTimelinessMultiplier(multipliers.timeliness, payload);
  breakdown.timelinessMultiplier = timeMult;

  // Evidence multiplier
  const evidMult = resolveMultiplier(multipliers.evidence, payload.evidenceLevel ?? payload.evidence);
  breakdown.evidenceMultiplier = evidMult;

  // Quality multiplier (grade-based)
  const qualMult = resolveQualityMultiplier(multipliers.quality, payload.grade);
  breakdown.qualityMultiplier = qualMult;

  const rawAmount = Math.round(base * effortMult * diffMult * timeMult * evidMult * qualMult);
  const amount = Math.max(0, rawAmount); // XP can never go negative from multipliers

  return { amount, breakdown };
}

/**
 * Resolve a simple tier-based multiplier.
 * multiplierMap: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25 }
 * value: "HIGH" → returns 1.25
 */
function resolveMultiplier(multiplierMap, value) {
  if (!multiplierMap || typeof multiplierMap !== "object" || !value) return 1.0;
  return multiplierMap[value] ?? 1.0;
}

function resolveEffortMultiplier(payload) {
  if (!payload || payload.taskType === undefined) return 1.0;

  const points = Number(payload.actualPoints ?? payload.storyPoints);
  if (!Number.isFinite(points) || points <= 0) return 0;

  return Math.min(2.0, Math.max(0.35, points / 3));
}

/**
 * Resolve timeliness multiplier based on how late the task was completed.
 * Expected payload fields: submittedAt, dueDate (or dueDate from task)
 */
function resolveTimelinessMultiplier(timelinessMap, payload) {
  if (!timelinessMap || typeof timelinessMap !== "object") return 1.0;
  if (Object.keys(timelinessMap).length === 0) return 1.0;

  // If the event payload includes a pre-computed timeliness tier, use it
  if (payload.timeliness && timelinessMap[payload.timeliness] !== undefined) {
    return timelinessMap[payload.timeliness];
  }

  // Default: on time
  return timelinessMap.onTime ?? 1.0;
}

/**
 * Resolve quality multiplier based on grade ranges.
 * qualityMap: { "90-100": 1.2, "80-89": 1.0, "70-79": 0.8, "60-69": 0.5, "below60": 0 }
 */
function resolveQualityMultiplier(qualityMap, grade) {
  if (!qualityMap || typeof qualityMap !== "object" || grade === undefined || grade === null) {
    return 1.0;
  }

  const g = Number(grade);
  if (Number.isNaN(g)) return 1.0;

  if (g >= 90 && qualityMap["90-100"] !== undefined) return qualityMap["90-100"];
  if (g >= 80 && qualityMap["80-89"] !== undefined) return qualityMap["80-89"];
  if (g >= 70 && qualityMap["70-79"] !== undefined) return qualityMap["70-79"];
  if (g >= 60 && qualityMap["60-69"] !== undefined) return qualityMap["60-69"];
  if (qualityMap.below60 !== undefined) return qualityMap.below60;

  return 1.0;
}
