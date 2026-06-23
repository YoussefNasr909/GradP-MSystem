import type { APIRequestContext } from "@playwright/test"

export const apiBaseURL = process.env.E2E_API_BASE_URL ?? "http://localhost:4000/api/v1"

export type ApiUser = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email: string
  phone?: string | null
  academicId?: string | null
  department?: string | null
  academicYear?: string | null
  preferredTrack?: string | null
  avatarUrl?: string | null
  bio?: string | null
  linkedinUrl?: string | null
  githubUsername?: string | null
  role: "ADMIN" | "DOCTOR" | "TA" | "LEADER" | "STUDENT" | "SUPPORT"
}

export type LoginResult = {
  token: string
  user: ApiUser
}

type ApiEnvelope<T> = {
  ok: boolean
  data: T
  code?: string
  message?: string
}

export async function apiLogin(request: APIRequestContext, email: string, password: string): Promise<LoginResult | null> {
  const response = await request.post(`${apiBaseURL}/auth/login`, {
    data: { email, password },
    failOnStatusCode: false,
  })

  if (!response.ok()) return null

  const body = (await response.json()) as ApiEnvelope<LoginResult>
  return body.data
}

export async function apiGet<T>(request: APIRequestContext, path: string, token: string): Promise<T | null> {
  const response = await request.get(`${apiBaseURL}${path.startsWith("/") ? path : `/${path}`}`, {
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false,
  })

  if (!response.ok()) return null

  const body = (await response.json()) as ApiEnvelope<T>
  return body.data
}
