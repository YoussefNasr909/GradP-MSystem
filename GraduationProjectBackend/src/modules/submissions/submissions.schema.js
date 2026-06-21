import { z } from "zod";

const deliverableTypeSchema = z.enum([
  "SRS",
  "UML",
  "PROTOTYPE",
  "CODE",
  "TEST_PLAN",
  "FINAL_REPORT",
  "PRESENTATION",
]);

const sdlcPhaseSchema = z.enum([
  "REQUIREMENTS",
  "DESIGN",
  "IMPLEMENTATION",
  "TESTING",
  "DEPLOYMENT",
  "MAINTENANCE",
]);

const submissionStatusSchema = z.enum([
  "PENDING",
  "UNDER_REVIEW",
  "REVISION_REQUIRED",
  "APPROVED",
]);

export const listSubmissionsSchema = z.object({
  params: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
  query: z.object({
    teamId: z.string().trim().min(1).optional(),
    sdlcPhase: sdlcPhaseSchema.optional(),
    deliverableType: deliverableTypeSchema.optional(),
    status: submissionStatusSchema.optional(),
  }),
});

export const submissionByIdSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1),
  }),
  query: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
});

const rubricItemSchema = z.object({
  name: z.string().trim().min(1, "Criterion name is required").max(120, "Criterion name must be 120 characters or less"),
  score: z.coerce.number().min(0).max(100),
  maxScore: z.coerce.number().min(1).max(100),
});

const rubricSchema = z.array(rubricItemSchema).max(15).optional();

// Doctor final grade
export const gradeSubmissionSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1),
  }),
  query: z.object({}).optional().default({}),
  body: z.object({
    grade: z.coerce.number().int().min(0).max(100),
    feedback: z.string().trim().min(3).max(2000).optional(),
    rubric: rubricSchema,
    reason: z.string().trim().max(500).optional(),
    overrideReason: z.string().trim().max(500).optional(),
  }),
});

// Unlock an approved submission for re-grading
export const unlockSubmissionSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body: z.object({
    reason: z.string().trim().min(5).max(500),
  }),
});

// Attach (or detach) a defense meeting to a DEPLOYMENT-phase submission
export const attachDefenseSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body: z.object({
    meetingId: z.string().trim().min(1).nullable(),
  }),
});

// Bulk approve a list of submissions
export const bulkApproveSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({}).optional().default({}),
  body: z.object({
    submissionIds: z.array(z.string().trim().min(1)).min(1).max(50),
    feedback: z.string().trim().max(2000).optional(),
  }),
});

// TA first-pass recommendation
export const taReviewSubmissionSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1),
  }),
  query: z.object({}).optional().default({}),
  body: z.object({
    recommendedGrade: z.coerce.number().int().min(0).max(100),
    feedback: z.string().trim().min(3).max(2000).optional(),
    rubric: rubricSchema,
  }),
});

export const requestRevisionSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1),
  }),
  query: z.object({}).optional().default({}),
  body: z.object({
    feedback: z.string().trim().min(10).max(2000),
  }),
});

export const sdlcSummarySchema = z.object({
  params: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
  query: z.object({
    teamId: z.string().trim().min(1).optional(),
  }),
});

export const advanceStageSchema = z.object({
  params: z.object({}).optional().default({}),
  body: z.object({}).optional().default({}),
  query: z.object({
    teamId: z.string().trim().min(1).optional(),
  }),
});

const createSubmissionInputSchema = z.object({
  deliverableType: deliverableTypeSchema,
  sdlcPhase: sdlcPhaseSchema,
  title: z.string().trim().min(3).max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  deadline: z.string().trim().optional().nullable(),
});

export function parseCreateSubmissionBody(rawBody) {
  return createSubmissionInputSchema.parse(rawBody ?? {});
}
