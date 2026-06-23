import type { APIRequestContext, Page } from "@playwright/test"
import { expect } from "@playwright/test"
import { apiLogin, type ApiUser, type LoginResult } from "./api"
import { testUserCandidates, type AppRole, type TestUserCandidate } from "../fixtures/users"

export type ResolvedTestUser = TestUserCandidate & LoginResult

const resolvedByRole = new Map<AppRole, ResolvedTestUser>()

function mapApiRoleToUiRole(role: ApiUser["role"]) {
  switch (role) {
    case "ADMIN":
      return "admin"
    case "DOCTOR":
      return "doctor"
    case "TA":
      return "ta"
    case "LEADER":
      return "leader"
    case "SUPPORT":
      return "support"
    case "STUDENT":
    default:
      return "member"
  }
}

function humanizeEnum(value?: string | null) {
  if (!value) return undefined
  if (value === "CYBERSECURITY_INFOSEC") return "Cybersecurity / Information Security"
  return value
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
    .join(" ")
}

export function mapApiUserToUiUser(user: ApiUser) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email.split("@")[0]

  return {
    id: user.id,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    name,
    email: user.email,
    phone: user.phone ?? undefined,
    role: mapApiRoleToUiRole(user.role),
    avatar: user.avatarUrl ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    studentCode: user.academicId ?? undefined,
    academicId: user.academicId ?? undefined,
    departmentRaw: user.department ?? null,
    academicYearRaw: user.academicYear ?? null,
    preferredTrackRaw: user.preferredTrack ?? null,
    department: humanizeEnum(user.department),
    academicYear: user.academicYear ?? null,
    preferredTrack: user.preferredTrack ?? null,
    bio: user.bio ?? undefined,
    linkedinUrl: user.linkedinUrl ?? undefined,
    githubUsername: user.githubUsername ?? undefined,
  }
}

export async function resolveTestUser(request: APIRequestContext, role: AppRole): Promise<ResolvedTestUser | null> {
  const cached = resolvedByRole.get(role)
  if (cached) return cached

  for (const candidate of testUserCandidates[role]) {
    const login = await apiLogin(request, candidate.email, candidate.password)
    if (!login) continue

    const resolved = { ...candidate, ...login }
    resolvedByRole.set(role, resolved)
    return resolved
  }

  return null
}

export async function signInWithUser(page: Page, user: ResolvedTestUser) {
  const persistedState = {
    state: {
      currentUser: mapApiUserToUiUser(user.user),
      accessToken: user.token,
      rememberSession: true,
    },
    version: 0,
  }

  await page.addInitScript((state) => {
    window.localStorage.setItem("gpms-auth", JSON.stringify(state))
  }, persistedState)
}

export async function signInAs(page: Page, role: AppRole) {
  const user = await resolveTestUser(page.request, role)
  if (!user) return null
  await signInWithUser(page, user)
  return user
}

export async function clearAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("gpms-auth")
    window.sessionStorage.removeItem("gpms-auth")
  })
}

export async function loginThroughUi(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password)
  await page.getByRole("button", { name: "Sign In" }).click()
  await expect(page).toHaveURL(/\/dashboard(?:$|\?)/, { timeout: 15_000 })
}

export async function logoutThroughUi(page: Page) {
  await page.getByRole("button").filter({ hasText: /Admin|Supervisor|TA|Leader|Member/i }).click()
  await page.getByRole("menuitem", { name: "Logout" }).click()
  await expect(page.getByRole("dialog", { name: "Signing out" })).toBeVisible()
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
}
