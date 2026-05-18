-- Backfill anti-farming caps for existing task XP rules.
UPDATE "GamificationRule"
SET
  "caps" = CASE "code"
    WHEN 'TASK_APPROVED_MEETING' THEN '{"maxPerTask":1,"maxXpPerUserPerDay":120,"maxXpPerUserPerWeek":300}'::jsonb
    WHEN 'TASK_APPROVED_OTHER' THEN '{"maxPerTask":1,"maxXpPerUserPerDay":180,"maxXpPerUserPerWeek":500}'::jsonb
    ELSE '{"maxPerTask":1,"maxXpPerUserPerDay":300,"maxXpPerUserPerWeek":900}'::jsonb
  END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN (
  'TASK_APPROVED_CODE',
  'TASK_APPROVED_DOCUMENTATION',
  'TASK_APPROVED_DESIGN',
  'TASK_APPROVED_RESEARCH',
  'TASK_APPROVED_MEETING',
  'TASK_APPROVED_PRESENTATION',
  'TASK_APPROVED_OTHER'
)
AND "version" = 1;

-- Seed the first sprint completion team XP rule without requiring a manual db seed.
INSERT INTO "GamificationRule" (
  "id",
  "code",
  "name",
  "description",
  "eventType",
  "targetType",
  "baseXp",
  "conditions",
  "multipliers",
  "caps",
  "version",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  'rule_sprint_completed_team_v1',
  'SPRINT_COMPLETED_TEAM',
  'Sprint Completed (Team)',
  'Team XP awarded when an active sprint is completed, scaled by completion percentage.',
  'SPRINT_COMPLETED',
  'TEAM',
  120,
  '{}'::jsonb,
  '{"quality":{"90-100":1.25,"80-89":1.0,"70-79":0.7,"60-69":0.4,"below60":0}}'::jsonb,
  '{"maxPerSprint":1}'::jsonb,
  1,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code", "version") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "eventType" = EXCLUDED."eventType",
  "targetType" = EXCLUDED."targetType",
  "baseXp" = EXCLUDED."baseXp",
  "conditions" = EXCLUDED."conditions",
  "multipliers" = EXCLUDED."multipliers",
  "caps" = EXCLUDED."caps",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;
