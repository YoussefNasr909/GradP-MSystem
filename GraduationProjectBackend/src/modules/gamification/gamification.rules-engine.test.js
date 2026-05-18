import assert from "node:assert/strict";
import test from "node:test";
import { calculateXp, matchRules } from "./gamification.rules-engine.js";

test("calculateXp scales task XP by story point effort", () => {
  const rule = {
    baseXp: 90,
    multipliers: {
      difficulty: { MEDIUM: 1, HIGH: 1.25 },
      timeliness: { onTime: 1, lt24h: 0.8 },
    },
  };

  const defaultEffort = calculateXp(rule, {
    taskType: "CODE",
    storyPoints: 3,
    priority: "MEDIUM",
    timeliness: "onTime",
  });
  const tinyTask = calculateXp(rule, {
    taskType: "CODE",
    storyPoints: 1,
    priority: "MEDIUM",
    timeliness: "onTime",
  });
  const largeTask = calculateXp(rule, {
    taskType: "CODE",
    storyPoints: 8,
    priority: "MEDIUM",
    timeliness: "onTime",
  });

  assert.equal(defaultEffort.amount, 90);
  assert.equal(tinyTask.amount, 31);
  assert.equal(largeTask.amount, 180);
  assert.equal(largeTask.breakdown.effortMultiplier, 2);
});

test("calculateXp does not effort-scale non-task events", () => {
  const result = calculateXp({ baseXp: 100, multipliers: {} }, { grade: 90 });

  assert.equal(result.amount, 100);
  assert.equal(result.breakdown.effortMultiplier, 1);
});

test("boolean rule conditions require an explicit truthy payload flag", () => {
  const rules = [
    {
      code: "GITHUB_PR_MERGED_TASK_LINKED",
      eventType: "GITHUB_PR_MERGED",
      conditions: { requireTaskLink: true },
    },
  ];

  assert.equal(
    matchRules(rules, {
      eventType: "GITHUB_PR_MERGED",
      payload: { taskId: "task-1" },
    }).length,
    0,
  );
  assert.equal(
    matchRules(rules, {
      eventType: "GITHUB_PR_MERGED",
      payload: { taskId: "task-1", requireTaskLink: true },
    }).length,
    1,
  );
});

test("boolean false rule conditions require an explicit falsy payload flag", () => {
  const rules = [
    {
      code: "NO_TASK_LINK",
      eventType: "GITHUB_PR_MERGED",
      conditions: { requireTaskLink: false },
    },
  ];

  assert.equal(
    matchRules(rules, {
      eventType: "GITHUB_PR_MERGED",
      payload: {},
    }).length,
    0,
  );
  assert.equal(
    matchRules(rules, {
      eventType: "GITHUB_PR_MERGED",
      payload: { requireTaskLink: true },
    }).length,
    0,
  );
  assert.equal(
    matchRules(rules, {
      eventType: "GITHUB_PR_MERGED",
      payload: { requireTaskLink: false },
    }).length,
    1,
  );
});
