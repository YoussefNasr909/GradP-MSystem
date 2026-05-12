import { apiRequest } from "./http"
import type { ApiSprint, ApiSprintBoard, ApiSprintStatus, ApiSprintTask } from "./types"

type ListSprintsParams = {
  teamId?: string
}

type SprintPayload = {
  teamId?: string
  name: string
  goal?: string
  startDate: string
  endDate: string
  status?: ApiSprintStatus
}

type UpdateSprintPayload = Partial<Omit<SprintPayload, "teamId">>

type SprintTaskPayload = {
  storyPoints?: number
  actualPoints?: number | null
  unplanned?: boolean
}

function buildSprintsQuery(params: ListSprintsParams = {}) {
  const searchParams = new URLSearchParams()

  if (params.teamId) searchParams.set("teamId", params.teamId)

  const query = searchParams.toString()
  return query ? `/sprints?${query}` : "/sprints"
}

export const sprintsApi = {
  board: (params?: ListSprintsParams) => apiRequest<ApiSprintBoard>(buildSprintsQuery(params)),
  create: (payload: SprintPayload) =>
    apiRequest<ApiSprint>("/sprints", {
      method: "POST",
      body: payload,
    }),
  update: (id: string, payload: UpdateSprintPayload) =>
    apiRequest<ApiSprint>(`/sprints/${id}`, {
      method: "PATCH",
      body: payload,
    }),
  start: (id: string) =>
    apiRequest<ApiSprint>(`/sprints/${id}/start`, {
      method: "POST",
    }),
  complete: (id: string) =>
    apiRequest<ApiSprint>(`/sprints/${id}/complete`, {
      method: "POST",
    }),
  assignTask: (sprintId: string, taskId: string, payload?: SprintTaskPayload) =>
    apiRequest<ApiSprintTask>(`/sprints/${sprintId}/tasks/${taskId}`, {
      method: "POST",
      body: payload ?? {},
    }),
  moveTaskToBacklog: (taskId: string) =>
    apiRequest<ApiSprintTask>(`/sprints/backlog/tasks/${taskId}`, {
      method: "POST",
    }),
  updateTask: (taskId: string, payload: SprintTaskPayload) =>
    apiRequest<ApiSprintTask>(`/sprints/tasks/${taskId}`, {
      method: "PATCH",
      body: payload,
    }),
}
