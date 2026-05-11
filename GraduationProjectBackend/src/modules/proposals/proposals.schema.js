import { z } from "zod";

const proposalStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "REJECTED",
]);

// Re-usable proposal body shape (used for create/update).
// Length floors are intentionally generous on the read path,
// but firm on the write path to encourage substantive proposals.
const proposalBodySchema = z.object({
  title:            z.string().trim().min(5).max(200),
  abstract:         z.string().trim().min(50).max(2000),
  problemStatement: z.string().trim().min(50).max(3000),
  scope:            z.string().trim().min(20).max(3000),
  methodology:      z.string().trim().min(20).max(3000),
  timeline:         z.string().trim().max(2000).optional().nullable(),
  objectives:       z.array(z.string().trim().min(3).max(300)).min(1).max(15),
  technologies:     z.array(z.string().trim().min(1).max(80)).min(1).max(30),
  deliverables:     z.array(z.string().trim().min(3).max(300)).min(1).max(20),
});

export const createProposalSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({}).optional().default({}),
  body:   proposalBodySchema,
});

export const updateProposalSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body:   proposalBodySchema.partial(),
});

export const proposalByIdSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body:   z.object({}).optional().default({}),
});

export const listProposalsSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({
    teamId: z.string().trim().min(1).optional(),
    status: proposalStatusSchema.optional(),
    search: z.string().trim().max(200).optional(),
  }),
  body:   z.object({}).optional().default({}),
});

export const reviewProposalSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body:   z.object({
    decision: z.enum(["APPROVED", "REJECTED", "REVISION_REQUESTED"]),
    feedback: z.string().trim().min(10).max(3000).optional(),
  }),
});

export const submitProposalSchema = proposalByIdSchema;
