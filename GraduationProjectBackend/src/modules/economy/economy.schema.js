import { z } from "zod";

const emptyBody = z.object({}).optional().default({});
const emptyQuery = z.object({}).optional().default({});
const emptyParams = z.object({}).optional().default({});

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const questTypeSchema = z.enum(["DAILY", "WEEKLY", "MILESTONE"]);
const questMetricSchema = z.enum([
  "XP_EARNED",
  "TASKS_DONE",
  "SUBMISSIONS_APPROVED",
  "PRS_MERGED",
  "REVIEWS_GIVEN",
  "SPRINTS_COMPLETED",
  "WEEKLY_REPORTS_APPROVED",
  "LOGIN_STREAK",
]);
const rewardTypeSchema = z.enum(["AVATAR_FRAME", "PROFILE_THEME", "TITLE", "BADGE_SKIN"]);
const rewardStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

const metadataSchema = z.record(z.string(), z.unknown()).nullable().optional();

export const getEconomyOverviewSchema = z.object({
  params: emptyParams,
  body: emptyBody,
  query: emptyQuery,
});

export const getMyQuestsSchema = z.object({
  params: emptyParams,
  body: emptyBody,
  query: emptyQuery,
});

export const claimQuestSchema = z.object({
  params: z.object({
    progressId: z.string().trim().min(1),
  }),
  body: emptyBody,
  query: emptyQuery,
});

export const getRewardsSchema = z.object({
  params: emptyParams,
  body: emptyBody,
  query: emptyQuery,
});

export const purchaseRewardSchema = z.object({
  params: z.object({
    rewardItemId: z.string().trim().min(1),
  }),
  body: emptyBody,
  query: emptyQuery,
});

export const equipRewardSchema = z.object({
  params: z.object({
    purchaseId: z.string().trim().min(1),
  }),
  body: z.object({
    equipped: z.boolean().default(true),
  }).optional().default({ equipped: true }),
  query: emptyQuery,
});

export const getCoinTransactionsSchema = z.object({
  params: emptyParams,
  body: emptyBody,
  query: z.object(paginationQuery),
});

export const getAdminQuestsSchema = z.object({
  params: emptyParams,
  body: emptyBody,
  query: z.object({
    ...paginationQuery,
    status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().default("ALL"),
  }),
});

export const saveAdminQuestSchema = z.object({
  params: z.object({
    questId: z.string().trim().min(1).optional(),
  }).optional().default({}),
  query: emptyQuery,
  body: z.object({
    code: z.string().trim().min(3).max(80).regex(/^[A-Z0-9_]+$/),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(5).max(500),
    type: questTypeSchema,
    metric: questMetricSchema,
    targetValue: z.coerce.number().int().min(1).max(100000),
    coinReward: z.coerce.number().int().min(0).max(100000),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(100000).default(100),
    metadata: metadataSchema,
  }),
});

export const getAdminRewardsSchema = z.object({
  params: emptyParams,
  body: emptyBody,
  query: z.object({
    ...paginationQuery,
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED", "ALL"]).optional().default("ALL"),
  }),
});

export const saveAdminRewardSchema = z.object({
  params: z.object({
    rewardItemId: z.string().trim().min(1).optional(),
  }).optional().default({}),
  query: emptyQuery,
  body: z.object({
    code: z.string().trim().min(3).max(80).regex(/^[A-Z0-9_]+$/),
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().min(5).max(500),
    type: rewardTypeSchema,
    cost: z.coerce.number().int().min(0).max(100000),
    status: rewardStatusSchema.default("ACTIVE"),
    inventory: z.coerce.number().int().min(0).max(100000).optional().nullable(),
    imageUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
    sortOrder: z.coerce.number().int().min(0).max(100000).default(100),
    metadata: metadataSchema,
  }).transform((value) => ({
    ...value,
    imageUrl: value.imageUrl || null,
  })),
});
