import { z } from "zod";

// ─── Shared helpers ──────────────────────────────────────────

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const periodFilter = {
  period: z.enum(["week", "month", "semester", "lifetime"]).optional(),
};

const statusFilter = {
  status: z.string().trim().min(1).optional(),
};

const leaderboardTypeSchema = z.enum([
  "INDIVIDUAL_WEEKLY",
  "INDIVIDUAL_SEMESTER",
  "INDIVIDUAL_LIFETIME",
  "TEAM_WEEKLY",
  "TEAM_SEMESTER",
]);

// ─── Student / User endpoints ────────────────────────────────

export const getMyOverviewSchema = z.object({
  params: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
  query: z.object({
    ...periodFilter,
  }).optional().default({}),
});

export const getMyHistorySchema = z.object({
  params: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
  query: z.object({
    ...paginationQuery,
    ...statusFilter,
    sourceType: z.string().trim().min(1).optional(),
  }),
});

export const getMyBadgesSchema = z.object({
  params: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

// ─── Team endpoints ──────────────────────────────────────────

export const getTeamSummarySchema = z.object({
  params: z.object({
    teamId: z.string().trim().min(1),
  }),
  body: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export const getTeamHistorySchema = z.object({
  params: z.object({
    teamId: z.string().trim().min(1),
  }),
  body: z.object({}).optional().default({}),
  query: z.object({
    ...paginationQuery,
    ...statusFilter,
  }),
});

// ─── Leaderboard endpoints ───────────────────────────────────

export const getLeaderboardsSchema = z.object({
  params: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
  query: z.object({
    type: leaderboardTypeSchema.optional().default("INDIVIDUAL_WEEKLY"),
    ...paginationQuery,
  }),
});

// ─── Rules endpoint ──────────────────────────────────────────

export const getRulesSchema = z.object({
  params: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
  query: z.object({
    eventType: z.string().trim().min(1).optional(),
    activeOnly: z
      .enum(["true", "false"])
      .optional()
      .default("true")
      .transform((v) => v === "true"),
  }),
});

// ─── Admin endpoints ─────────────────────────────────────────

export const getAdminCasesSchema = z.object({
  params: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
  query: z.object({
    ...paginationQuery,
    ...statusFilter,
    teamId: z.string().trim().min(1).optional(),
    userId: z.string().trim().min(1).optional(),
  }),
});

export const resolveAdminCaseSchema = z.object({
  params: z.object({
    caseId: z.string().trim().min(1),
  }),
  query: z.object({}).optional().default({}),
  body: z.object({
    decision: z.enum(["APPROVE", "REJECT"]),
    resolution: z.string().trim().min(5).max(1000),
    studentVisibleReason: z.string().trim().max(500).optional(),
  }),
});

export const getAdminAdjustmentsSchema = z.object({
  params: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
  query: z.object({
    ...paginationQuery,
    ...statusFilter,
  }),
});

export const createAdminAdjustmentSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z
    .object({
      targetUserId: z.string().trim().min(1).optional(),
      targetTeamId: z.string().trim().min(1).optional(),
      amount: z.coerce.number().int().min(-10000).max(10000).refine((value) => value !== 0, {
        message: "Amount must not be zero.",
      }),
      reason: z.string().trim().min(10).max(1000),
      sourceReference: z.string().trim().max(500).optional(),
    })
    .refine((body) => Boolean(body.targetUserId) !== Boolean(body.targetTeamId), {
      message: "Provide exactly one of targetUserId or targetTeamId.",
      path: ["targetUserId"],
    }),
});

export const reviewAdminAdjustmentSchema = z.object({
  params: z.object({
    adjustmentId: z.string().trim().min(1),
  }),
  query: z.object({}).optional().default({}),
  body: z.object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reviewComment: z.string().trim().min(5).max(1000),
  }),
});

export const getAdminAuditLogsSchema = z.object({
  params: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
  query: z.object({
    ...paginationQuery,
    action: z.string().trim().min(1).optional(),
    targetType: z.string().trim().min(1).optional(),
    targetId: z.string().trim().min(1).optional(),
  }),
});

export const generateLeaderboardSnapshotsSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z
    .object({
      types: z.array(leaderboardTypeSchema).min(1).max(5).optional(),
    })
    .optional()
    .default({}),
});

export const processEventsSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z
    .object({
      retryFailed: z.boolean().optional().default(false),
      eventIds: z.array(z.string().trim().min(1)).max(50).optional().default([]),
    })
    .optional()
    .default({ retryFailed: false, eventIds: [] }),
});
