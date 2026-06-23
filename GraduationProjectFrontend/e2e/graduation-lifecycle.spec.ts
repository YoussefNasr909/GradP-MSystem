import { expect, test, type APIRequestContext } from "@playwright/test";
import { expectApiOk } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginApi, loginByApi, type AuthSession } from "./utils/auth";
import { assertLoadedOrBlocked } from "./utils/guards";
import { createTeamWithAcceptedMember } from "./utils/teams";
import { createProposal, createTask } from "./utils/workflows";
import { uniqueSuffix } from "./utils/users";

type SdlcPhase = "REQUIREMENTS" | "DESIGN" | "IMPLEMENTATION" | "TESTING" | "DEPLOYMENT";
type DeliverableType = "SRS" | "UML" | "CODE" | "TEST_PLAN" | "FINAL_REPORT" | "PRESENTATION";

test.describe("full graduation project lifecycle", () => {
  test("leader team moves from setup to final defense with supervisors, proposal, task evidence, submissions, and stage advancement", async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(180_000);

    const suffix = uniqueSuffix(testInfo);
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const doctor = await loginApi(request, seedUsers.doctor.email);
    const ta = await loginApi(request, seedUsers.ta.email);

    await assignSupervisor(request, bundle.leaderSession.token, doctor, bundle.team.id, "Doctor", suffix);
    await assignSupervisor(request, bundle.leaderSession.token, ta, bundle.team.id, "TA", suffix);

    const assignedTeam = await expectApiOk<any>(request, `/teams/${bundle.team.id}`, { token: bundle.leaderSession.token });
    expect(assignedTeam.data.doctor?.email).toBe(seedUsers.doctor.email);
    expect(assignedTeam.data.ta?.email).toBe(seedUsers.ta.email);

    const proposal = await createProposal(request, bundle.leaderSession, suffix);
    await expectApiOk(request, `/proposals/${proposal.id}/submit`, {
      method: "POST",
      token: bundle.leaderSession.token,
    });
    const reviewedProposal = await expectApiOk<any>(request, `/proposals/${proposal.id}/review`, {
      method: "PATCH",
      token: doctor.token,
      data: { decision: "APPROVED", feedback: "Approved for the end-to-end lifecycle validation run." },
    });
    expect(reviewedProposal.data.status).toBe("APPROVED");

    const task = await createTask(request, bundle.leaderSession, bundle.team.id, bundle.member.id, suffix);
    await expectApiOk(request, `/tasks/${task.id}/accept`, { method: "POST", token: bundle.memberSession.token });
    await expectApiOk(request, `/tasks/${task.id}/evidence/link`, {
      method: "POST",
      token: bundle.memberSession.token,
      data: { title: "Lifecycle evidence", url: "https://example.com/gpms-lifecycle-evidence" },
    });
    await expectApiOk(request, `/tasks/${task.id}/submit-review`, {
      method: "POST",
      token: bundle.memberSession.token,
    });
    const approvedTask = await expectApiOk<any>(request, `/tasks/${task.id}/approve`, {
      method: "POST",
      token: ta.token,
      data: { reviewComment: "Evidence reviewed by the assigned TA for lifecycle coverage." },
    });
    expect(["DONE", "APPROVED"]).toContain(approvedTask.data.status);

    await submitReviewGradeAndMaybeAdvance(request, bundle.leaderSession, ta, doctor, {
      phase: "REQUIREMENTS",
      deliverable: "SRS",
      title: `Lifecycle SRS ${suffix}`,
      grade: 91,
      advanceAfter: true,
    });
    await submitReviewGradeAndMaybeAdvance(request, bundle.leaderSession, ta, doctor, {
      phase: "DESIGN",
      deliverable: "UML",
      title: `Lifecycle UML ${suffix}`,
      grade: 92,
      advanceAfter: true,
    });
    await submitReviewGradeAndMaybeAdvance(request, bundle.leaderSession, ta, doctor, {
      phase: "IMPLEMENTATION",
      deliverable: "CODE",
      title: `Lifecycle Code ${suffix}`,
      grade: 93,
      advanceAfter: true,
    });
    await submitReviewGradeAndMaybeAdvance(request, bundle.leaderSession, ta, doctor, {
      phase: "TESTING",
      deliverable: "TEST_PLAN",
      title: `Lifecycle Test Plan ${suffix}`,
      grade: 94,
      advanceAfter: true,
    });

    const finalReportDefense = await createCompletedDefenseMeeting(request, doctor, bundle.team.id, `${suffix}-report`, 1);
    const finalReport = await submitReviewGradeAndMaybeAdvance(request, bundle.leaderSession, ta, doctor, {
      phase: "DEPLOYMENT",
      deliverable: "FINAL_REPORT",
      title: `Lifecycle Final Report ${suffix}`,
      grade: 95,
      defenseMeetingId: finalReportDefense.id,
      advanceAfter: false,
    });

    const presentationDefense = await createCompletedDefenseMeeting(request, doctor, bundle.team.id, `${suffix}-presentation`, 2);
    const presentation = await submitReviewGradeAndMaybeAdvance(request, bundle.leaderSession, ta, doctor, {
      phase: "DEPLOYMENT",
      deliverable: "PRESENTATION",
      title: `Lifecycle Presentation ${suffix}`,
      grade: 96,
      defenseMeetingId: presentationDefense.id,
      advanceAfter: true,
    });

    expect(finalReport.status).toBe("APPROVED");
    expect(presentation.status).toBe("APPROVED");

    const completedTeam = await expectApiOk<any>(request, `/teams/${bundle.team.id}`, { token: bundle.leaderSession.token });
    expect(completedTeam.data.stage).toBe("MAINTENANCE");

    await loginByApi(page, request, bundle.leader.email, "/dashboard/my-team");
    await expect(page.getByText(/Loading your team/i)).toBeHidden({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /E2E Team/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Maintenance/i).first()).toBeVisible();

    await page.goto("/dashboard/tasks", { waitUntil: "domcontentloaded" });
    await assertLoadedOrBlocked(page);
    await expect(page.getByText(task.title).first()).toBeVisible();

    await page.goto("/dashboard/submissions", { waitUntil: "domcontentloaded" });
    await assertLoadedOrBlocked(page);
    await expect(page.getByText(/Final Report|Presentation|Approved/i).first()).toBeVisible();
  });
});

async function assignSupervisor(
  request: APIRequestContext,
  leaderToken: string,
  supervisor: AuthSession,
  teamId: string,
  label: "Doctor" | "TA",
  suffix: string,
) {
  const profile = await expectApiOk<any>(request, "/auth/me", { token: supervisor.token });
  const supervisorRequest = await expectApiOk<any>(request, `/teams/${teamId}/supervisor-requests`, {
    method: "POST",
    token: leaderToken,
    data: {
      supervisorId: profile.data.id,
      projectName: `Lifecycle ${label} ${suffix}`.slice(0, 120),
      projectDescription: `Assign the ${label} to supervise a full graduation lifecycle E2E validation run.`,
      technologies: ["Next.js", "Express", "Playwright"],
    },
  });

  const accepted = await expectApiOk<any>(request, `/teams/supervisor-requests/${supervisorRequest.data.id}/accept`, {
    method: "POST",
    token: supervisor.token,
  });
  expect(accepted.data.status).toBe("ACCEPTED");
  return accepted.data;
}

async function createSubmission(
  request: APIRequestContext,
  leaderToken: string,
  phase: SdlcPhase,
  deliverable: DeliverableType,
  title: string,
) {
  const created = await expectApiOk<any>(request, "/submissions", {
    method: "POST",
    token: leaderToken,
    multipart: {
      deliverableType: deliverable,
      sdlcPhase: phase,
      title,
      notes: `${title} uploaded by the full lifecycle E2E test.`,
      file: {
        name: `${deliverable.toLowerCase().replace(/_/g, "-")}.txt`,
        mimeType: "text/plain",
        buffer: Buffer.from(`${title}\nLifecycle deliverable content.\n`),
      },
    },
  });
  expect(created.data.deliverableType).toBe(deliverable);
  return created.data;
}

async function submitReviewGradeAndMaybeAdvance(
  request: APIRequestContext,
  leader: AuthSession,
  ta: AuthSession,
  doctor: AuthSession,
  options: {
    phase: SdlcPhase;
    deliverable: DeliverableType;
    title: string;
    grade: number;
    defenseMeetingId?: string;
    advanceAfter: boolean;
  },
) {
  const submission = await createSubmission(request, leader.token, options.phase, options.deliverable, options.title);
  await expectApiOk(request, `/submissions/${submission.id}/ta-review`, {
    method: "PATCH",
    token: ta.token,
    data: {
      recommendedGrade: options.grade - 1,
      feedback: `TA review completed for ${options.deliverable}.`,
    },
  });

  if (options.defenseMeetingId) {
    await expectApiOk(request, `/submissions/${submission.id}/defense`, {
      method: "PATCH",
      token: doctor.token,
      data: { meetingId: options.defenseMeetingId },
    });
  }

  const graded = await expectApiOk<any>(request, `/submissions/${submission.id}/grade`, {
    method: "PATCH",
    token: doctor.token,
    data: {
      grade: options.grade,
      feedback: `Doctor final grade approved for ${options.deliverable}.`,
    },
  });
  expect(graded.data.status).toBe("APPROVED");
  expect(graded.data.grade).toBe(options.grade);

  if (options.advanceAfter) {
    await expectApiOk(request, "/submissions/advance-stage", {
      method: "POST",
      token: leader.token,
    });
  }

  return graded.data;
}

async function createCompletedDefenseMeeting(
  request: APIRequestContext,
  doctor: AuthSession,
  teamId: string,
  suffix: string,
  offsetDays: number,
) {
  const start = new Date();
  start.setDate(start.getDate() + offsetDays);
  start.setHours(start.getHours() + 2 + offsetDays);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  const meeting = await expectApiOk<any>(request, "/meetings", {
    method: "POST",
    token: doctor.token,
    data: {
      teamId,
      title: `Lifecycle defense ${suffix}`.slice(0, 140),
      description: "Defense meeting created by the full lifecycle E2E test.",
      agenda: "Review final deployment deliverable and approve graduation project readiness.",
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      timezone: "Africa/Cairo",
      mode: "VIRTUAL",
      provider: "MANUAL",
      location: "Lifecycle E2E room",
      includeDoctor: true,
      includeTa: true,
      includeTeamMembers: true,
    },
  });

  return (await expectApiOk<any>(request, `/meetings/${meeting.data.id}/complete`, {
    method: "POST",
    token: doctor.token,
  })).data;
}
