import { apiRequest } from "./http"
import type { ApiCalendarEvent, ApiCalendarIntegration, ApiCalendarProvider } from "./types"

type ListEventsParams = {
  start?: string
  end?: string
}

function buildEventsQuery(params: ListEventsParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.start) searchParams.set("start", params.start)
  if (params.end) searchParams.set("end", params.end)
  const query = searchParams.toString()
  return query ? `/calendar/events?${query}` : "/calendar/events"
}

export const calendarApi = {
  listEvents: (params?: ListEventsParams) => apiRequest<ApiCalendarEvent[]>(buildEventsQuery(params)),
  listIntegrations: () => apiRequest<ApiCalendarIntegration[]>("/calendar/integrations"),
  connectGoogle: () => apiRequest<{ url: string }>("/calendar/integrations/google/connect", { method: "POST" }),
  connectOutlook: () => apiRequest<{ url: string }>("/calendar/integrations/outlook/connect", { method: "POST" }),
  disconnect: (provider: ApiCalendarProvider) =>
    apiRequest(`/calendar/integrations/${provider}/disconnect`, { method: "POST" }),
  syncProvider: (provider: ApiCalendarProvider, meetingId?: string) =>
    apiRequest(`/calendar/integrations/${provider}/sync`, { method: "POST", body: meetingId ? { meetingId } : {} }),
}
