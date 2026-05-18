import { z } from "zod";

const reportStatusValues = ["DRAFT", "SUBMITTED", "APPROVED", "CHANGES_REQUESTED"];

export const listWeeklyReportsSchema = z.object({
  body: z.any().optional(),
  params: z.any().optional(),
  query: z.object({
    teamId: z.string().trim().min(1).optional(),
    status: z.enum(reportStatusValues).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }),
});

export const submitWeeklyReportSchema = z.object({
  body: z.object({
    summaryFinal: z.string().trim().min(20, "Weekly report summary must be at least 20 characters").max(12000),
  }),
  query: z.any().optional(),
  params: z.object({
    id: z.string().trim().min(1, "Weekly report id is required"),
  }),
});

export const reviewWeeklyReportSchema = z.object({
  body: z.object({
    decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
    reviewComment: z.string().trim().max(4000).optional(),
  }),
  query: z.any().optional(),
  params: z.object({
    id: z.string().trim().min(1, "Weekly report id is required"),
  }),
});
