import type { APIRequestContext, APIResponse } from "@playwright/test"
import { test, expect } from "./fixtures/test"
import { apiBaseURL, apiLogin, type ApiUser, type LoginResult } from "./helpers/api"
import { loginThroughUi, resolveTestUser } from "./helpers/auth"

type ApiEnvelope<T> = {
  ok: boolean
  data: T
  code?: string
  message?: string
}

type UserSummary = {
  id: string
  email?: string
  firstName?: string | null
  lastName?: string | null
}

type LifecycleUser = ApiUser & {
  accountStatus?: "ACTIVE" | "INACTIVE" | "SUSPENDED"
  isEmailVerified?: boolean
}

type UsersResponse = {
  items: LifecycleUser[]
}

type TeamDetail = {
  id: string
  name: string
  stage: SdlcPhase
  leader: UserSummary
  doctor: UserSummary | null
  ta: UserSummary | null
}

type TeamState = {
  team: TeamDetail | null
}

type SupervisorRequest = {
  id: string
  supervisorRole: "DOCTOR" | "TA"
  status: string
}

type Proposal = {
  id: string
  status: string
}

type Task = {
  id: string
  title: string
  status: string
}

type Meeting = {
  id: string
  status: string
}

type Submission = {
  id: string
  deliverableType: DeliverableType
  sdlcPhase: SdlcPhase
  status: string
  grade: number | null
  defenseMeetingId?: string | null
}

type DeliverableType =
  | "SRS"
  | "UML"
  | "CODE"
  | "TEST_PLAN"
  | "FINAL_REPORT"
  | "PRESENTATION"

type SdlcPhase =
  | "REQUIREMENTS"
  | "DESIGN"
  | "IMPLEMENTATION"
  | "TESTING"
  | "DEPLOYMENT"
  | "MAINTENANCE"

const lifecycleEmail = (process.env.E2E_LIFECYCLE_EMAIL ?? "abdelrahman.naser958@gmail.com").toLowerCase()
const lifecyclePassword = process.env.E2E_LIFECYCLE_PASSWORD ?? "Lifecycle123!"
const lifecycleTeamPrefix = "E2E Lifecycle -"
const apiTimeout = 60_000

test.describe.configure({ mode: "serial" })

test.describe("Graduation project lifecycle", () => {
  test("student leader can complete the full assigned project lifecycle", async ({ page }) => {
    test.setTimeout(180_000)

    const admin = await resolveTestUser(page.request, "admin")
    const doctor = await resolveTestUser(page.request, "doctor")
    const ta = await resolveTestUser(page.request, "ta")

    expect(admin, "admin account should be available").not.toBeNull()
    expect(doctor, "doctor account should be available").not.toBeNull()
    expect(ta, "TA account should be available").not.toBeNull()

    const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)
    const teamName = `${lifecycleTeamPrefix} ${runId}`

    const leader = await ensureLifecycleLeader(page.request, admin!.token, lifecycleEmail, lifecyclePassword)

    await loginThroughUi(page, lifecycleEmail, lifecyclePassword)

    await resetPreviousLifecycleTeam(page.request, leader.token)

    const team = await createTeam(page.request, leader.token, teamName)
    await assignSupervisor(page.request, leader.token, doctor!.token, team.id, doctor!.user.id, "Doctor")
    await assignSupervisor(page.request, leader.token, ta!.token, team.id, ta!.user.id, "TA")

    const assignedTeam = await apiGetOrThrow<TeamDetail>(page.request, `/teams/${team.id}`, leader.token)
    expect(assignedTeam.doctor?.id).toBe(doctor!.user.id)
    expect(assignedTeam.ta?.id).toBe(ta!.user.id)

    const proposal = await createApprovedProposal(page.request, leader.token, doctor!.token)
    expect(proposal.status).toBe("APPROVED")

    const task = await completeManualTask(page.request, leader.token, ta!.token, team.id, leader.user.id)
    expect(task.status).toBe("DONE")

    await submitReviewGradeAndAdvance(page.request, leader.token, ta!.token, doctor!.token, {
      phase: "REQUIREMENTS",
      deliverable: "SRS",
      title: "Lifecycle SRS",
      grade: 91,
      advanceAfter: true,
    })
    await submitReviewGradeAndAdvance(page.request, leader.token, ta!.token, doctor!.token, {
      phase: "DESIGN",
      deliverable: "UML",
      title: "Lifecycle UML Package",
      grade: 92,
      advanceAfter: true,
    })
    await submitReviewGradeAndAdvance(page.request, leader.token, ta!.token, doctor!.token, {
      phase: "IMPLEMENTATION",
      deliverable: "CODE",
      title: "Lifecycle Implementation Package",
      grade: 93,
      advanceAfter: true,
    })
    await submitReviewGradeAndAdvance(page.request, leader.token, ta!.token, doctor!.token, {
      phase: "TESTING",
      deliverable: "TEST_PLAN",
      title: "Lifecycle Test Plan",
      grade: 94,
      advanceAfter: true,
    })

    const reportDefenseMeeting = await createCompletedDefenseMeeting(page.request, doctor!.token, team.id, 1)
    const presentationDefenseMeeting = await createCompletedDefenseMeeting(page.request, doctor!.token, team.id, 2)
    const finalReport = await submitReviewGradeAndAdvance(page.request, leader.token, ta!.token, doctor!.token, {
      phase: "DEPLOYMENT",
      deliverable: "FINAL_REPORT",
      title: "Lifecycle Final Report",
      grade: 95,
      defenseMeetingId: reportDefenseMeeting.id,
      advanceAfter: false,
    })
    const presentation = await submitReviewGradeAndAdvance(page.request, leader.token, ta!.token, doctor!.token, {
      phase: "DEPLOYMENT",
      deliverable: "PRESENTATION",
      title: "Lifecycle Final Presentation",
      grade: 96,
      defenseMeetingId: presentationDefenseMeeting.id,
      advanceAfter: true,
    })

    expect(finalReport.status).toBe("APPROVED")
    expect(presentation.status).toBe("APPROVED")

    const completedTeam = await apiGetOrThrow<TeamDetail>(page.request, `/teams/${team.id}`, leader.token)
    expect(completedTeam.stage).toBe("MAINTENANCE")

    await page.goto("/dashboard/my-team")
    await expect(page.getByText(teamName).first()).toBeVisible()

    await page.goto("/dashboard/tasks")
    await expect(page.getByText(task.title).first()).toBeVisible()

    await page.goto("/dashboard/submissions")
    await expect(page.getByText(/Final Report|Presentation|Approved/i).first()).toBeVisible()
  })
})

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function apiUrl(path: string) {
  return `${apiBaseURL}${path.startsWith("/") ? path : `/${path}`}`
}

async function unwrapApiResponse<T>(response: APIResponse, action: string): Promise<T> {
  const text = await response.text()
  const body = text ? (JSON.parse(text) as ApiEnvelope<T>) : null

  if (!response.ok()) {
    const detail = body?.message ?? body?.code ?? text
    throw new Error(`${action} failed with ${response.status()}: ${detail}`)
  }

  if (!body?.ok) {
    throw new Error(`${action} returned an unexpected response`)
  }

  return body.data
}

async function apiGetOrThrow<T>(request: APIRequestContext, path: string, token: string) {
  const response = await request.get(apiUrl(path), {
    headers: authHeaders(token),
    failOnStatusCode: false,
    timeout: apiTimeout,
  })

  return unwrapApiResponse<T>(response, `GET ${path}`)
}

async function apiPostOrThrow<T>(request: APIRequestContext, path: string, token: string, data?: unknown) {
  const response = await request.post(apiUrl(path), {
    headers: authHeaders(token),
    data,
    failOnStatusCode: false,
    timeout: apiTimeout,
  })

  return unwrapApiResponse<T>(response, `POST ${path}`)
}

async function apiPatchOrThrow<T>(request: APIRequestContext, path: string, token: string, data: unknown) {
  const response = await request.patch(apiUrl(path), {
    headers: authHeaders(token),
    data,
    failOnStatusCode: false,
    timeout: apiTimeout,
  })

  return unwrapApiResponse<T>(response, `PATCH ${path}`)
}

async function apiDeleteOrThrow<T>(request: APIRequestContext, path: string, token: string) {
  const response = await request.delete(apiUrl(path), {
    headers: authHeaders(token),
    failOnStatusCode: false,
    timeout: apiTimeout,
  })

  return unwrapApiResponse<T>(response, `DELETE ${path}`)
}

function stableAcademicId(email: string) {
  let hash = 0
  for (const char of email) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return `E2E-LIFE-${hash.toString(36).toUpperCase()}`
}

async function ensureLifecycleLeader(
  request: APIRequestContext,
  adminToken: string,
  email: string,
  password: string,
): Promise<LoginResult> {
  const users = await apiGetOrThrow<UsersResponse>(request, `/users?search=${encodeURIComponent(email)}&limit=50`, adminToken)
  const existing = users.items.find((user) => user.email.toLowerCase() === email)
  const userPayload = {
    firstName: "Abdelrahman",
    lastName: "Naser",
    email,
    phone: "01000000000",
    role: "LEADER",
    password,
    academicId: existing?.academicId ?? stableAcademicId(email),
    accountStatus: "ACTIVE",
    department: "COMPUTER_SCIENCE",
    academicYear: "YEAR_5",
    preferredTrack: "FULLSTACK_DEVELOPMENT",
  }

  const user = existing
    ? await apiPatchOrThrow<LifecycleUser>(request, `/users/${existing.id}`, adminToken, userPayload)
    : await apiPostOrThrow<LifecycleUser>(request, "/users", adminToken, userPayload)

  if (user.isEmailVerified === false) {
    throw new Error(`Lifecycle user ${email} exists but is not email verified. Verify it or remove it before running this test.`)
  }

  const login = await apiLogin(request, email, password)
  expect(login, "lifecycle leader should be able to log in after setup").not.toBeNull()
  expect(login!.user.role).toBe("LEADER")
  return login!
}

async function resetPreviousLifecycleTeam(request: APIRequestContext, leaderToken: string) {
  const state = await apiGetOrThrow<TeamState>(request, "/teams/my", leaderToken)
  if (!state.team) return

  if (!state.team.name.startsWith(lifecycleTeamPrefix)) {
    throw new Error(
      `Lifecycle user already belongs to non-test team "${state.team.name}". Use a fresh E2E email or remove that team manually.`,
    )
  }

  await apiDeleteOrThrow<TeamDetail>(request, `/teams/${state.team.id}`, leaderToken)
}

async function createTeam(request: APIRequestContext, leaderToken: string, teamName: string) {
  return apiPostOrThrow<TeamDetail>(request, "/teams", leaderToken, {
    name: teamName,
    bio: "End-to-end lifecycle test team for validating the graduation project flow.",
    stack: ["Next.js", "Node.js", "Prisma"],
    maxMembers: 3,
    visibility: "PUBLIC",
    allowJoinRequests: false,
    stage: "REQUIREMENTS",
  })
}

async function assignSupervisor(
  request: APIRequestContext,
  leaderToken: string,
  supervisorToken: string,
  teamId: string,
  supervisorId: string,
  label: "Doctor" | "TA",
) {
  const supervisorRequest = await apiPostOrThrow<SupervisorRequest>(request, `/teams/${teamId}/supervisor-requests`, leaderToken, {
    supervisorId,
    projectName: `${label} Lifecycle Assignment`,
    projectDescription: "Supervisor assignment created by the graduation lifecycle E2E test.",
    technologies: ["Next.js", "Node.js"],
  })

  return apiPostOrThrow<SupervisorRequest>(
    request,
    `/teams/supervisor-requests/${supervisorRequest.id}/accept`,
    supervisorToken,
  )
}

async function createApprovedProposal(request: APIRequestContext, leaderToken: string, doctorToken: string) {
  const proposal = await apiPostOrThrow<Proposal>(request, "/proposals", leaderToken, {
    title: "Lifecycle Project Validation Platform",
    abstract:
      "This proposal describes a complete graduation project lifecycle validation platform that tracks team setup, supervision, task delivery, submissions, review, and final grading.",
    problemStatement:
      "Graduation project teams need a reliable workflow that connects supervisors, task management, deliverable submissions, and final evaluation without losing traceability between stages.",
    scope:
      "The scope covers team setup, supervisor assignment, task execution, deliverable review, defense completion, and final project delivery.",
    methodology:
      "The team will use iterative development, documented SDLC gates, supervisor reviews, and evidence-backed tasks to move from requirements through deployment.",
    timeline: "Requirements, design, implementation, testing, deployment, and maintenance are completed in sequence.",
    objectives: [
      "Validate the lifecycle workflow",
      "Track project evidence",
      "Complete final delivery",
    ],
    technologies: ["Next.js", "Node.js", "Prisma"],
    deliverables: ["SRS", "UML", "Code package", "Test plan", "Final report", "Presentation"],
  })

  const submitted = await apiPostOrThrow<Proposal>(request, `/proposals/${proposal.id}/submit`, leaderToken)
  expect(submitted.status).toMatch(/SUBMITTED|UNDER_REVIEW/)

  return apiPatchOrThrow<Proposal>(request, `/proposals/${proposal.id}/review`, doctorToken, {
    decision: "APPROVED",
    feedback: "Approved for the lifecycle validation run.",
  })
}

function ymd(offsetDays: number) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

async function completeManualTask(
  request: APIRequestContext,
  leaderToken: string,
  taToken: string,
  teamId: string,
  assigneeUserId: string,
) {
  const task = await apiPostOrThrow<Task>(request, "/tasks", leaderToken, {
    teamId,
    title: "Complete lifecycle implementation slice",
    description: "Manual evidence task used by the lifecycle E2E test.",
    priority: "HIGH",
    storyPoints: 5,
    taskType: "CODE",
    integrationMode: "MANUAL",
    startDate: ymd(0),
    endDate: ymd(7),
    assigneeUserId,
  })

  await apiPostOrThrow<Task>(request, `/tasks/${task.id}/accept`, leaderToken)
  await apiPostOrThrow(request, `/tasks/${task.id}/evidence/link`, leaderToken, {
    title: "Lifecycle evidence",
    url: "https://example.com/lifecycle-evidence",
  })
  await apiPostOrThrow<Task>(request, `/tasks/${task.id}/submit-review`, leaderToken)

  return apiPostOrThrow<Task>(request, `/tasks/${task.id}/approve`, taToken, {
    reviewComment: "Manual lifecycle task evidence approved.",
  })
}

async function createSubmission(
  request: APIRequestContext,
  leaderToken: string,
  phase: SdlcPhase,
  deliverable: DeliverableType,
  title: string,
) {
  const response = await request.post(apiUrl("/submissions"), {
    headers: authHeaders(leaderToken),
    multipart: {
      deliverableType: deliverable,
      sdlcPhase: phase,
      title,
      notes: `${title} uploaded by the graduation lifecycle E2E test.`,
      file: {
        name: `${deliverable.toLowerCase().replace(/_/g, "-")}.txt`,
        mimeType: "text/plain",
        buffer: Buffer.from(`${title}\nLifecycle deliverable content.\n`, "utf8"),
      },
    },
    failOnStatusCode: false,
    timeout: apiTimeout,
  })

  return unwrapApiResponse<Submission>(response, `POST /submissions ${deliverable}`)
}

async function reviewAndGradeSubmission(
  request: APIRequestContext,
  taToken: string,
  doctorToken: string,
  submission: Submission,
  grade: number,
  defenseMeetingId?: string,
) {
  await apiPatchOrThrow<Submission>(request, `/submissions/${submission.id}/ta-review`, taToken, {
    recommendedGrade: grade - 1,
    feedback: "TA review completed for lifecycle validation.",
  })

  if (defenseMeetingId) {
    await apiPatchOrThrow<Submission>(request, `/submissions/${submission.id}/defense`, doctorToken, {
      meetingId: defenseMeetingId,
    })
  }

  return apiPatchOrThrow<Submission>(request, `/submissions/${submission.id}/grade`, doctorToken, {
    grade,
    feedback: "Doctor final grade approved for lifecycle validation.",
  })
}

async function submitReviewGradeAndAdvance(
  request: APIRequestContext,
  leaderToken: string,
  taToken: string,
  doctorToken: string,
  options: {
    phase: SdlcPhase
    deliverable: DeliverableType
    title: string
    grade: number
    defenseMeetingId?: string
    advanceAfter: boolean
  },
) {
  const submission = await createSubmission(request, leaderToken, options.phase, options.deliverable, options.title)
  const graded = await reviewAndGradeSubmission(
    request,
    taToken,
    doctorToken,
    submission,
    options.grade,
    options.defenseMeetingId,
  )

  expect(graded.status).toBe("APPROVED")
  expect(graded.grade).toBe(options.grade)

  if (options.advanceAfter) {
    await apiPostOrThrow<TeamDetail>(request, "/submissions/advance-stage", leaderToken)
  }

  return graded
}

async function createCompletedDefenseMeeting(
  request: APIRequestContext,
  doctorToken: string,
  teamId: string,
  offsetDays: number,
) {
  const start = new Date()
  start.setDate(start.getDate() + offsetDays)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)

  const meeting = await apiPostOrThrow<Meeting>(request, "/meetings", doctorToken, {
    teamId,
    title: `Lifecycle final defense ${offsetDays}`,
    description: "Defense meeting for deployment deliverables in the lifecycle E2E test.",
    agenda: "Review final report and presentation.",
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    timezone: "Africa/Cairo",
    mode: "VIRTUAL",
    provider: "MANUAL",
    location: "Lifecycle test room",
    includeDoctor: true,
    includeTa: true,
    includeTeamMembers: true,
  })

  expect(meeting.status).toBe("CONFIRMED")
  return apiPostOrThrow<Meeting>(request, `/meetings/${meeting.id}/complete`, doctorToken)
}
