import { apiRequest } from "./http"
import type {
  ApiSupportSummary,
  ApiSupportSavedReply,
  ApiSupportTicketCategory,
  ApiSupportTicketDetail,
  ApiSupportTicketMessageVisibility,
  ApiSupportTicketPriority,
  ApiSupportTicketSource,
  ApiSupportTicketStatus,
  ApiSupportTicketSummary,
  ApiSupportUser,
  Paginated,
} from "./types"

export type ListSupportTicketsParams = {
  page?: number
  limit?: number
  search?: string
  status?: ApiSupportTicketStatus
  statusGroup?: "active" | "archive"
  priority?: ApiSupportTicketPriority
  category?: ApiSupportTicketCategory
  assignedTo?: string
  tags?: string[]
  sla?: "overdue" | "dueSoon" | "ok"
  source?: ApiSupportTicketSource
  createdFrom?: string
  createdTo?: string
}

export type CreateSupportTicketPayload = {
  subject: string
  description: string
  category: ApiSupportTicketCategory
  priority: ApiSupportTicketPriority
  tags?: string[]
}

export type UpdateSupportTicketPayload = {
  status?: ApiSupportTicketStatus
  priority?: ApiSupportTicketPriority
  category?: ApiSupportTicketCategory
  assignedSupportUserId?: string | null
  tags?: string[]
  snoozedUntil?: string | null
}

export type BulkUpdateSupportTicketsPayload = UpdateSupportTicketPayload & {
  ticketIds: string[]
}

export type SupportSavedReplyPayload = {
  title: string
  body: string
  category?: ApiSupportTicketCategory | null
}

function ticketsQuery(params: ListSupportTicketsParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set("page", String(params.page))
  if (params.limit) searchParams.set("limit", String(params.limit))
  if (params.search) searchParams.set("search", params.search)
  if (params.status) searchParams.set("status", params.status)
  if (params.statusGroup) searchParams.set("statusGroup", params.statusGroup)
  if (params.priority) searchParams.set("priority", params.priority)
  if (params.category) searchParams.set("category", params.category)
  if (params.assignedTo) searchParams.set("assignedTo", params.assignedTo)
  if (params.tags?.length) searchParams.set("tags", params.tags.join(","))
  if (params.sla) searchParams.set("sla", params.sla)
  if (params.source) searchParams.set("source", params.source)
  if (params.createdFrom) searchParams.set("createdFrom", params.createdFrom)
  if (params.createdTo) searchParams.set("createdTo", params.createdTo)
  const query = searchParams.toString()
  return query ? `/support/tickets?${query}` : "/support/tickets"
}

function ticketFormData(payload: CreateSupportTicketPayload, files?: File[]) {
  const formData = new FormData()
  formData.append("subject", payload.subject)
  formData.append("description", payload.description)
  formData.append("category", payload.category)
  formData.append("priority", payload.priority)
  for (const tag of payload.tags ?? []) formData.append("tags[]", tag)
  for (const file of files ?? []) formData.append("files", file)
  return formData
}

function messageFormData(payload: { body: string; visibility?: ApiSupportTicketMessageVisibility; savedReplyId?: string }, files?: File[]) {
  const formData = new FormData()
  formData.append("body", payload.body)
  if (payload.visibility) formData.append("visibility", payload.visibility)
  if (payload.savedReplyId) formData.append("savedReplyId", payload.savedReplyId)
  for (const file of files ?? []) formData.append("files", file)
  return formData
}

export const supportApi = {
  summary: () => apiRequest<ApiSupportSummary>("/support/summary"),
  agents: () => apiRequest<ApiSupportUser[]>("/support/agents"),
  listTickets: (params?: ListSupportTicketsParams) => apiRequest<Paginated<ApiSupportTicketSummary>>(ticketsQuery(params)),
  createTicket: (payload: CreateSupportTicketPayload, files?: File[]) =>
    apiRequest<ApiSupportTicketDetail>("/support/tickets", {
      method: "POST",
      body: ticketFormData(payload, files),
    }),
  quickChat: (payload?: { content?: string; subject?: string; category?: ApiSupportTicketCategory; priority?: ApiSupportTicketPriority }) =>
    apiRequest<ApiSupportTicketDetail>("/support/tickets/quick-chat", {
      method: "POST",
      body: payload ?? {},
    }),
  getTicket: (id: string) => apiRequest<ApiSupportTicketDetail>(`/support/tickets/${id}`),
  addMessage: (id: string, payload: { body: string; visibility?: ApiSupportTicketMessageVisibility; savedReplyId?: string }, files?: File[]) =>
    apiRequest<ApiSupportTicketDetail>(`/support/tickets/${id}/messages`, {
      method: "POST",
      body: messageFormData(payload, files),
    }),
  updateTicket: (id: string, payload: UpdateSupportTicketPayload) =>
    apiRequest<ApiSupportTicketDetail>(`/support/tickets/${id}`, {
      method: "PATCH",
      body: payload,
    }),
  bulkUpdateTickets: (payload: BulkUpdateSupportTicketsPayload) =>
    apiRequest<{ updatedCount: number; tickets: ApiSupportTicketDetail[] }>("/support/tickets/bulk", {
      method: "PATCH",
      body: payload,
    }),
  reopenTicket: (id: string, payload?: { body?: string }) =>
    apiRequest<ApiSupportTicketDetail>(`/support/tickets/${id}/reopen`, {
      method: "POST",
      body: payload ?? {},
    }),
  listSavedReplies: (params?: { category?: ApiSupportTicketCategory; includeInactive?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.category) searchParams.set("category", params.category)
    if (params?.includeInactive) searchParams.set("includeInactive", "true")
    const query = searchParams.toString()
    return apiRequest<ApiSupportSavedReply[]>(query ? `/support/saved-replies?${query}` : "/support/saved-replies")
  },
  createSavedReply: (payload: SupportSavedReplyPayload) =>
    apiRequest<ApiSupportSavedReply>("/support/saved-replies", {
      method: "POST",
      body: payload,
    }),
  updateSavedReply: (id: string, payload: Partial<SupportSavedReplyPayload> & { isActive?: boolean }) =>
    apiRequest<ApiSupportSavedReply>(`/support/saved-replies/${id}`, {
      method: "PATCH",
      body: payload,
    }),
  deleteSavedReply: (id: string) =>
    apiRequest<{ id: string; deleted: boolean }>(`/support/saved-replies/${id}`, {
      method: "DELETE",
    }),
}
