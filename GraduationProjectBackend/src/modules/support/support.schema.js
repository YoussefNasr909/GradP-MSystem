import { z } from "zod";

export const SUPPORT_TICKET_STATUS_VALUES = ["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"];
export const SUPPORT_TICKET_PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const SUPPORT_TICKET_CATEGORY_VALUES = ["BUG", "FEATURE", "QUESTION", "ACCOUNT", "TECHNICAL", "GENERAL"];
export const SUPPORT_TICKET_SOURCE_VALUES = ["FORM", "CHAT"];
export const SUPPORT_TICKET_MESSAGE_VISIBILITY_VALUES = ["PUBLIC", "INTERNAL"];
export const SUPPORT_TICKET_SLA_VALUES = ["overdue", "dueSoon", "ok"];
export const SUPPORT_TICKET_STATUS_GROUP_VALUES = ["active", "archive"];

const idSchema = z.string().trim().min(1, "id is required");
const optionalTrimmed = z.string().trim().optional();
const tagsSchema = z.array(z.string().trim().min(1).max(32)).max(8).optional();
const nullableDateSchema = z.coerce.date().nullable().optional();

export const listSupportTicketsSchema = z.object({
  body: z.any().optional(),
  params: z.any().optional(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    search: optionalTrimmed,
    status: z.enum(SUPPORT_TICKET_STATUS_VALUES).optional(),
    statusGroup: z.enum(SUPPORT_TICKET_STATUS_GROUP_VALUES).optional(),
    priority: z.enum(SUPPORT_TICKET_PRIORITY_VALUES).optional(),
    category: z.enum(SUPPORT_TICKET_CATEGORY_VALUES).optional(),
    assignedTo: z.string().trim().optional(),
    tags: optionalTrimmed,
    sla: z.enum(SUPPORT_TICKET_SLA_VALUES).optional(),
    source: z.enum(SUPPORT_TICKET_SOURCE_VALUES).optional(),
    createdFrom: z.coerce.date().optional(),
    createdTo: z.coerce.date().optional(),
  }),
});

export const supportTicketByIdSchema = z.object({
  body: z.any().optional(),
  query: z.any().optional(),
  params: z.object({ id: idSchema }),
});

export const createSupportTicketSchema = z.object({
  body: z.object({
    subject: z.string().trim().min(3, "Subject must be at least 3 characters.").max(150),
    description: z.string().trim().min(1, "Describe what you need help with.").max(4000),
    category: z.enum(SUPPORT_TICKET_CATEGORY_VALUES).default("GENERAL"),
    priority: z.enum(SUPPORT_TICKET_PRIORITY_VALUES).default("MEDIUM"),
    tags: tagsSchema,
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const quickChatSupportTicketSchema = z.object({
  body: z.object({
    content: z.string().trim().max(4000).optional().default("I need help from support."),
    subject: z.string().trim().min(3).max(150).optional().default("Support chat"),
    category: z.enum(SUPPORT_TICKET_CATEGORY_VALUES).optional().default("GENERAL"),
    priority: z.enum(SUPPORT_TICKET_PRIORITY_VALUES).optional().default("MEDIUM"),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const addSupportTicketMessageSchema = z.object({
  body: z.object({
    body: z.string().trim().max(4000).optional().default(""),
    visibility: z.enum(SUPPORT_TICKET_MESSAGE_VISIBILITY_VALUES).optional().default("PUBLIC"),
    savedReplyId: z.string().trim().min(1).optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: idSchema }),
});

export const updateSupportTicketSchema = z.object({
  body: z
    .object({
      status: z.enum(SUPPORT_TICKET_STATUS_VALUES).optional(),
      priority: z.enum(SUPPORT_TICKET_PRIORITY_VALUES).optional(),
      category: z.enum(SUPPORT_TICKET_CATEGORY_VALUES).optional(),
      assignedSupportUserId: z.string().trim().min(1).nullable().optional(),
      tags: tagsSchema,
      snoozedUntil: nullableDateSchema,
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "Provide at least one ticket field to update.",
    }),
  query: z.any().optional(),
  params: z.object({ id: idSchema }),
});

export const bulkUpdateSupportTicketsSchema = z.object({
  body: z
    .object({
      ticketIds: z.array(idSchema).min(1).max(50),
      status: z.enum(SUPPORT_TICKET_STATUS_VALUES).optional(),
      priority: z.enum(SUPPORT_TICKET_PRIORITY_VALUES).optional(),
      category: z.enum(SUPPORT_TICKET_CATEGORY_VALUES).optional(),
      assignedSupportUserId: z.string().trim().min(1).nullable().optional(),
      tags: tagsSchema,
      snoozedUntil: nullableDateSchema,
    })
    .refine((value) => Object.keys(value).some((key) => key !== "ticketIds"), {
      message: "Provide at least one ticket field to update.",
    }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const reopenSupportTicketSchema = z.object({
  body: z
    .object({
      body: z.string().trim().max(4000).optional(),
    })
    .optional()
    .default({}),
  query: z.any().optional(),
  params: z.object({ id: idSchema }),
});

export const supportSummarySchema = z.object({
  body: z.any().optional(),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const listSupportAgentsSchema = z.object({
  body: z.any().optional(),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const listSupportSavedRepliesSchema = z.object({
  body: z.any().optional(),
  query: z.object({
    category: z.enum(SUPPORT_TICKET_CATEGORY_VALUES).optional(),
    includeInactive: z.coerce.boolean().optional().default(false),
  }),
  params: z.any().optional(),
});

export const createSupportSavedReplySchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(120),
    body: z.string().trim().min(1).max(4000),
    category: z.enum(SUPPORT_TICKET_CATEGORY_VALUES).nullable().optional(),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateSupportSavedReplySchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(2).max(120).optional(),
      body: z.string().trim().min(1).max(4000).optional(),
      category: z.enum(SUPPORT_TICKET_CATEGORY_VALUES).nullable().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "Provide at least one saved reply field to update.",
    }),
  query: z.any().optional(),
  params: z.object({ id: idSchema }),
});

export const deleteSupportSavedReplySchema = z.object({
  body: z.any().optional(),
  query: z.any().optional(),
  params: z.object({ id: idSchema }),
});
