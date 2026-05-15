import { z } from "zod";

const SPRINT_STATUS_VALUES = ["PLANNED", "ACTIVE", "COMPLETED"];
const CREATE_SPRINT_STATUS_VALUES = ["PLANNED", "ACTIVE"];
const OWN_EVALUATION_STATUS_VALUES = ["DRAFT", "SUBMITTED"];
const REVIEW_EVALUATION_STATUS_VALUES = ["APPROVED", "REJECTED", "NEEDS_CHANGES"];
const EVALUATION_CRITERIA = [
  "planningQuality",
  "taskCompletion",
  "progressConsistency",
  "teamCollaboration",
  "deadlineCommitment",
];

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");

const sprintNameSchema = z.string().trim().min(3, "Sprint name must be at least 3 characters").max(120);
const sprintGoalSchema = z.string().trim().max(2000).optional();
const pointsSchema = z.coerce.number().int().min(0).max(99);
const criterionScoreSchema = z.coerce.number().int("Use a whole number from 0 to 20").min(0, "Score must be at least 0").max(20, "Score cannot be above 20");
const evaluationFeedbackSchema = z.string().trim().max(4000).optional();
const nullableCriterionSchema = z.preprocess((value) => (value === "" ? undefined : value), criterionScoreSchema.nullable().optional());

export const listSprintsSchema = z.object({
  body: z.any().optional(),
  params: z.any().optional(),
  query: z.object({
    teamId: z.string().trim().min(1).optional(),
  }),
});

export const listAssignedSprintTeamsSchema = z.object({
  body: z.any().optional(),
  params: z.any().optional(),
  query: z.any().optional(),
});

export const createSprintSchema = z.object({
  body: z
    .object({
      teamId: z.string().trim().min(1).optional(),
      name: sprintNameSchema,
      goal: sprintGoalSchema,
      startDate: dateStringSchema,
      endDate: dateStringSchema,
      status: z.enum(CREATE_SPRINT_STATUS_VALUES).optional(),
    })
    .refine((body) => body.endDate > body.startDate, {
      message: "End date must be after the start date",
      path: ["endDate"],
    }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateSprintSchema = z.object({
  body: z
    .object({
      name: sprintNameSchema.optional(),
      goal: sprintGoalSchema,
      startDate: dateStringSchema.optional(),
      endDate: dateStringSchema.optional(),
      status: z.enum(SPRINT_STATUS_VALUES).optional(),
    })
    .refine((body) => !body.startDate || !body.endDate || body.endDate > body.startDate, {
      message: "End date must be after the start date",
      path: ["endDate"],
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "Provide at least one field to update",
    }),
  query: z.any().optional(),
  params: z.object({
    id: z.string().trim().min(1, "Sprint id is required"),
  }),
});

export const upsertSprintEvaluationSchema = z.object({
  body: z
    .object({
      status: z.enum(OWN_EVALUATION_STATUS_VALUES).optional(),
      feedback: evaluationFeedbackSchema,
      earlyEvaluation: z.boolean().optional(),
      criteria: z
        .object({
          planningQuality: nullableCriterionSchema,
          taskCompletion: nullableCriterionSchema,
          progressConsistency: nullableCriterionSchema,
          teamCollaboration: nullableCriterionSchema,
          deadlineCommitment: nullableCriterionSchema,
        })
        .optional(),
    })
    .superRefine((body, ctx) => {
      if (body.status !== "SUBMITTED") return;

      const feedback = body.feedback?.trim() ?? "";
      if (feedback.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Feedback must be at least 10 characters before submitting.",
          path: ["feedback"],
        });
      }

      for (const criterion of EVALUATION_CRITERIA) {
        const value = body.criteria?.[criterion];
        if (value === undefined || value === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Enter a score from 0 to 20 before submitting.",
            path: ["criteria", criterion],
          });
        }
      }
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "Provide at least one evaluation field to update",
    }),
  query: z.any().optional(),
  params: z.object({
    id: z.string().trim().min(1, "Sprint id is required"),
  }),
});

export const reviewSprintEvaluationSchema = z.object({
  body: z.object({
    status: z.enum(REVIEW_EVALUATION_STATUS_VALUES),
    reviewComment: evaluationFeedbackSchema,
    earlyEvaluation: z.boolean().optional(),
  }),
  query: z.any().optional(),
  params: z.object({
    id: z.string().trim().min(1, "Sprint id is required"),
    evaluationId: z.string().trim().min(1, "Evaluation id is required"),
  }),
});

export const sprintActionSchema = z.object({
  body: z.any().optional(),
  query: z.any().optional(),
  params: z.object({
    id: z.string().trim().min(1, "Sprint id is required"),
  }),
});

export const assignSprintTaskSchema = z.object({
  body: z.object({
    storyPoints: pointsSchema.optional(),
    actualPoints: pointsSchema.nullable().optional(),
    unplanned: z.boolean().optional(),
  }),
  query: z.any().optional(),
  params: z.object({
    id: z.string().trim().min(1, "Sprint id is required"),
    taskId: z.string().trim().min(1, "Task id is required"),
  }),
});

export const backlogTaskSchema = z.object({
  body: z.any().optional(),
  query: z.any().optional(),
  params: z.object({
    taskId: z.string().trim().min(1, "Task id is required"),
  }),
});

export const updateSprintTaskSchema = z.object({
  body: z
    .object({
      storyPoints: pointsSchema.optional(),
      actualPoints: pointsSchema.nullable().optional(),
      unplanned: z.boolean().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "Provide at least one field to update",
    }),
  query: z.any().optional(),
  params: z.object({
    taskId: z.string().trim().min(1, "Task id is required"),
  }),
});
