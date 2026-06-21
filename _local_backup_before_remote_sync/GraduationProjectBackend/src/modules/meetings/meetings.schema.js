import { z } from "zod";

const meetingStatusValues = ["PENDING_APPROVAL", "CONFIRMED", "DECLINED", "CANCELLED", "COMPLETED"];
const meetingModeValues = ["VIRTUAL", "IN_PERSON", "HYBRID"];
const meetingProviderValues = ["GOOGLE_MEET", "MICROSOFT_TEAMS", "MANUAL"];
const calendarProviderValues = ["GOOGLE", "OUTLOOK"];

const externalGuestSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().optional(),
});

export const listMeetingsSchema = z.object({
  query: z.object({
    teamId: z.string().trim().optional(),
    status: z.enum(meetingStatusValues).optional(),
    start: z.string().trim().optional(),
    end: z.string().trim().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});

export const meetingParamsSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.any().optional(),
  query: z.any().optional(),
});

export const createMeetingSchema = z.object({
  body: z.object({
    teamId: z.string().trim().min(1),
    title: z.string().trim().min(3, "Meeting title must be at least 3 characters."),
    description: z.string().trim().optional(),
    agenda: z.string().trim().optional(),
    startAt: z.string().trim().min(1, "Start time is required."),
    endAt: z.string().trim().min(1, "End time is required."),
    timezone: z.string().trim().optional(),
    mode: z.enum(meetingModeValues).optional(),
    provider: z.enum(meetingProviderValues).optional(),
    externalProvider: z.enum(calendarProviderValues).nullable().optional(),
    location: z.string().trim().optional(),
    includeDoctor: z.boolean().optional(),
    includeTa: z.boolean().optional(),
    includeTeamMembers: z.boolean().optional(),
    participantUserIds: z.array(z.string().trim()).optional(),
    externalGuests: z.array(externalGuestSchema).optional(),
  }),
  params: z.any().optional(),
  query: z.any().optional(),
});

export const updateMeetingSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({
    title: z.string().trim().min(3, "Meeting title must be at least 3 characters.").optional(),
    description: z.string().trim().optional(),
    agenda: z.string().trim().optional(),
    startAt: z.string().trim().optional(),
    endAt: z.string().trim().optional(),
    timezone: z.string().trim().optional(),
    mode: z.enum(meetingModeValues).optional(),
    provider: z.enum(meetingProviderValues).optional(),
    externalProvider: z.enum(calendarProviderValues).nullable().optional(),
    location: z.string().trim().optional(),
  }),
  query: z.any().optional(),
});

export const declineMeetingSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({
    proposedStartAt: z.string().trim().min(1, "Proposed start time is required."),
    proposedEndAt: z.string().trim().min(1, "Proposed end time is required."),
    note: z.string().trim().optional(),
  }),
  query: z.any().optional(),
});

export const respondMeetingSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({ responseStatus: z.enum(["ACCEPTED", "DECLINED", "TENTATIVE"]) }),
  query: z.any().optional(),
});
