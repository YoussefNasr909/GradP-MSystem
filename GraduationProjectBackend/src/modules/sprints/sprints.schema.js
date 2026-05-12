import { z } from "zod";

const SPRINT_STATUS_VALUES = ["PLANNED", "ACTIVE", "COMPLETED"];

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");

const sprintNameSchema = z.string().trim().min(3, "Sprint name must be at least 3 characters").max(120);
const sprintGoalSchema = z.string().trim().max(2000).optional();
const pointsSchema = z.coerce.number().int().min(0).max(99);

export const listSprintsSchema = z.object({
  body: z.any().optional(),
  params: z.any().optional(),
  query: z.object({
    teamId: z.string().trim().min(1).optional(),
  }),
});

export const createSprintSchema = z.object({
  body: z
    .object({
      teamId: z.string().trim().min(1).optional(),
      name: sprintNameSchema,
      goal: sprintGoalSchema,
      startDate: dateStringSchema,
      endDate: dateStringSchema,
      status: z.enum(SPRINT_STATUS_VALUES).optional(),
    })
    .refine((body) => body.endDate >= body.startDate, {
      message: "End date must be on or after the start date",
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
    .refine((body) => Object.keys(body).length > 0, {
      message: "Provide at least one field to update",
    }),
  query: z.any().optional(),
  params: z.object({
    id: z.string().trim().min(1, "Sprint id is required"),
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
