import { apiRequest } from "./http"
import type {
  ApiSprint,
  ApiSprintBoard,
  ApiSprintEvaluation,
  ApiSprintEvaluationCriteria,
  ApiSprintEvaluationStatus,
  ApiSprintStatus,
  ApiSprintTask,
  ApiTeamSummary,
} from "./types"

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

type SprintEvaluationPayload = {
  status?: Extract<ApiSprintEvaluationStatus, "DRAFT" | "SUBMITTED">
  feedback?: string
  earlyEvaluation?: boolean
  criteria?: Partial<ApiSprintEvaluationCriteria>
}

type SprintEvaluationReviewPayload = {
  status: Extract<ApiSprintEvaluationStatus, "APPROVED" | "REJECTED" | "NEEDS_CHANGES">
  reviewComment?: string
  earlyEvaluation?: boolean
}

function buildSprintsQuery(params: ListSprintsParams = {}) {
  const searchParams = new URLSearchParams()

  if (params.teamId) searchParams.set("teamId", params.teamId)

  const query = searchParams.toString()
  return query ? `/sprints?${query}` : "/sprints"
}

export const sprintsApi = {
  assignedTeams: () => apiRequest<ApiTeamSummary[]>("/sprints/assigned-teams"),
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
  delete: (id: string) =>
    apiRequest<{ id: string; teamId: string; name: string; releasedTasks: number }>(`/sprints/${id}`, {
      method: "DELETE",
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
  saveEvaluation: (sprintId: string, payload: SprintEvaluationPayload) =>
    apiRequest<ApiSprintEvaluation>(`/sprints/${sprintId}/evaluations/me`, {
      method: "PUT",
      body: payload,
    }),
  reviewEvaluation: (sprintId: string, evaluationId: string, payload: SprintEvaluationReviewPayload) =>
    apiRequest<ApiSprintEvaluation>(`/sprints/${sprintId}/evaluations/${evaluationId}/review`, {
      method: "PATCH",
      body: payload,
    }),
}
