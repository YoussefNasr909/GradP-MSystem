import { apiRequest } from "./http"

export type ApiProposalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISION_REQUESTED"
  | "APPROVED"
  | "REJECTED"

export type ApiProposalUser = {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: string
  avatarUrl: string | null
}

export type ApiProposalTeam = {
  id: string
  name: string
  stage: string
  leaderId: string
  doctorId: string | null
  taId: string | null
}

export type ApiProposal = {
  id: string
  teamId: string
  authoredByUserId: string

  title: string
  abstract: string
  problemStatement: string
  scope: string
  methodology: string
  timeline: string | null
  objectives: string[]
  technologies: string[]
  deliverables: string[]

  fileName: string | null
  fileSize: number | null
  fileType: string | null
  fileUrl: string | null

  status: ApiProposalStatus
  feedback: string | null
  reviewedByUserId: string | null
  reviewedAt: string | null
  submittedAt: string | null

  version: number
  revisionCount: number

  createdAt: string
  updatedAt: string

  team: ApiProposalTeam
  authoredBy: ApiProposalUser | null
  reviewedBy: ApiProposalUser | null
}

export type ProposalBody = {
  title: string
  abstract: string
  problemStatement: string
  scope: string
  methodology: string
  timeline?: string | null
  objectives: string[]
  technologies: string[]
  deliverables: string[]
}

export type ReviewProposalPayload = {
  decision: "APPROVED" | "REJECTED" | "REVISION_REQUESTED"
  feedback?: string
}

type ListParams = { teamId?: string; status?: ApiProposalStatus; search?: string }

function buildQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  return q.toString()
}

export const proposalsApi = {
  list: (params: ListParams = {}) => {
    const q = buildQuery(params)
    return apiRequest<ApiProposal[]>(q ? `/proposals?${q}` : "/proposals")
  },

  /** Convenience for leader/member: returns their team's proposal (or null). */
  getMine: () => apiRequest<ApiProposal | null>("/proposals/mine"),

  get: (id: string) => apiRequest<ApiProposal>(`/proposals/${id}`),

  create: (body: ProposalBody) =>
    apiRequest<ApiProposal>("/proposals", { method: "POST", body }),

  update: (id: string, body: Partial<ProposalBody>) =>
    apiRequest<ApiProposal>(`/proposals/${id}`, { method: "PATCH", body }),

  submit: (id: string) =>
    apiRequest<ApiProposal>(`/proposals/${id}/submit`, { method: "POST" }),

  review: (id: string, payload: ReviewProposalPayload) =>
    apiRequest<ApiProposal>(`/proposals/${id}/review`, { method: "PATCH", body: payload }),

  delete: (id: string) =>
    apiRequest<{ ok: true }>(`/proposals/${id}`, { method: "DELETE" }),
}
