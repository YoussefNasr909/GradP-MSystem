import { apiRequest } from "./http"
import type {
  ApiCalendarProvider,
  ApiMeeting,
  ApiMeetingMode,
  ApiMeetingProvider,
  ApiMeetingResponseStatus,
  ApiMeetingStatus,
} from "./types"

type ListMeetingsParams = {
  teamId?: string
  status?: ApiMeetingStatus
  start?: string
  end?: string
}

export type CreateMeetingPayload = {
  teamId: string
  title: string
  description?: string
  agenda?: string
  startAt: string
  endAt: string
  timezone?: string
  mode?: ApiMeetingMode
  provider?: ApiMeetingProvider
  externalProvider?: ApiCalendarProvider | null
  location?: string
  includeDoctor?: boolean
  includeTa?: boolean
  includeTeamMembers?: boolean
  participantUserIds?: string[]
  externalGuests?: Array<{ email: string; displayName?: string }>
}

export type UpdateMeetingPayload = Partial<
  Omit<CreateMeetingPayload, "teamId" | "participantUserIds" | "externalGuests" | "includeDoctor" | "includeTa" | "includeTeamMembers">
>

function buildQuery(params: ListMeetingsParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.teamId) searchParams.set("teamId", params.teamId)
  if (params.status) searchParams.set("status", params.status)
  if (params.start) searchParams.set("start", params.start)
  if (params.end) searchParams.set("end", params.end)
  const query = searchParams.toString()
  return query ? `/meetings?${query}` : "/meetings"
}

export const meetingsApi = {
  list: (params?: ListMeetingsParams) => apiRequest<ApiMeeting[]>(buildQuery(params)),
  get: (id: string) => apiRequest<ApiMeeting>(`/meetings/${id}`),
  create: (payload: CreateMeetingPayload) =>
    apiRequest<ApiMeeting>("/meetings", { method: "POST", body: payload }),
  update: (id: string, payload: UpdateMeetingPayload) =>
    apiRequest<ApiMeeting>(`/meetings/${id}`, { method: "PATCH", body: payload }),
  approve: (id: string) => apiRequest<ApiMeeting>(`/meetings/${id}/approve`, { method: "POST" }),
  decline: (id: string, payload: { proposedStartAt: string; proposedEndAt: string; note?: string }) =>
    apiRequest<ApiMeeting>(`/meetings/${id}/decline`, { method: "POST", body: payload }),
  respond: (id: string, responseStatus: ApiMeetingResponseStatus) =>
    apiRequest<ApiMeeting>(`/meetings/${id}/respond`, { method: "POST", body: { responseStatus } }),
  cancel: (id: string) => apiRequest<ApiMeeting>(`/meetings/${id}/cancel`, { method: "POST" }),
  complete: (id: string) => apiRequest<ApiMeeting>(`/meetings/${id}/complete`, { method: "POST" }),
  sync: (id: string) => apiRequest<ApiMeeting>(`/meetings/${id}/sync`, { method: "POST" }),
  delete: (id: string) => apiRequest<{ id: string; deleted: boolean }>(`/meetings/${id}`, { method: "DELETE" }),
}
