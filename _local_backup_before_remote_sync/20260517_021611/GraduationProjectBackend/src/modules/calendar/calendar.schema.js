import { z } from "zod";

export const listCalendarEventsSchema = z.object({
  query: z.object({
    start: z.string().trim().optional(),
    end: z.string().trim().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});

export const providerParamsSchema = z.object({
  params: z.object({ provider: z.enum(["GOOGLE", "OUTLOOK", "google", "outlook"]) }),
  body: z.any().optional(),
  query: z.any().optional(),
});

export const syncProviderSchema = z.object({
  params: z.object({ provider: z.enum(["GOOGLE", "OUTLOOK", "google", "outlook"]) }),
  body: z.object({ meetingId: z.string().trim().optional() }).optional().default({}),
  query: z.any().optional(),
});
