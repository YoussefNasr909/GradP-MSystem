import { expect, test } from "@playwright/test";
import { apiRequest, expectApiOk, expectApiStatus } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginApi, loginByApi } from "./utils/auth";
import { assertLoadedOrBlocked } from "./utils/guards";
import { createTeamWithAcceptedMember } from "./utils/teams";
import { createSprint, createTask } from "./utils/workflows";
import { uniqueSuffix } from "./utils/users";

test.describe("tasks, sprints, and task evidence", () => {
  async function assignSeedTa(request: any, teamId: string, leaderToken: string) {
    const ta = await loginApi(request, seedUsers.ta.email);
    const taProfile = await expectApiOk<any>(request, "/auth/me", { token: ta.token });
    const supervisorRequest = await expectApiOk<any>(request, `/teams/${teamId}/supervisor-requests`, {
      method: "POST",
      token: leaderToken,
      data: {
        supervisorId: taProfile.data.id,
        projectName: "E2E Task Review",
        projectDescription: "Enough detail to assign the TA for sprint evaluation.",
        technologies: ["Testing"],
      },
    });
    await expectApiOk(request, `/teams/supervisor-requests/${supervisorRequest.data.id}/accept`, {
      method: "POST",
      token: ta.token,
    });
    return ta;
  }

  test("leader creates/starts sprint, creates task, member submits evidence, and leader approves", async ({ page, request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const sprint = await createSprint(request, bundle.leaderSession, bundle.team.id, uniqueSuffix(testInfo));
    const started = await expectApiOk<any>(request, `/sprints/${sprint.id}/start`, {
      method: "POST",
      token: bundle.leaderSession.token,
    });
    expect(started.data.status).toBe("ACTIVE");

    const task = await createTask(request, bundle.leaderSession, bundle.team.id, bundle.member.id, uniqueSuffix(testInfo));
    await expectApiOk(request, `/sprints/${sprint.id}/tasks/${task.id}`, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { storyPoints: 5 },
    });

    const accepted = await expectApiOk<any>(request, `/tasks/${task.id}/accept`, {
      method: "POST",
      token: bundle.memberSession.token,
    });
    expect(accepted.data.status).toBe("IN_PROGRESS");

    const evidence = await expectApiOk<any>(request, `/tasks/${task.id}/evidence/link`, {
      method: "POST",
      token: bundle.memberSession.token,
      data: { title: "Repository evidence", url: "https://example.com/evidence" },
    });
    expect(evidence.data.type).toBe("LINK");

    const submitted = await expectApiOk<any>(request, `/tasks/${task.id}/submit-review`, {
      method: "POST",
      token: bundle.memberSession.token,
    });
    expect(submitted.data.status).toBe("REVIEW");

    const approved = await expectApiOk<any>(request, `/tasks/${task.id}/approve`, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { reviewComment: "Evidence verified and task is accepted." },
    });
    expect(["DONE", "APPROVED"]).toContain(approved.data.status);

    const completed = await expectApiStatus(request, `/sprints/${sprint.id}/complete`, [200, 409], {
      method: "POST",
      token: bundle.leaderSession.token,
    });
    expect(JSON.stringify(completed.body)).toMatch(/COMPLETED|complete|task|sprint/i);

    await loginByApi(page, request, bundle.leader.email, "/dashboard/tasks");
    await assertLoadedOrBlocked(page);
    await page.goto("/dashboard/sprints");
    await assertLoadedOrBlocked(page);
  });

  test("rejected task returns to active state and invalid evidence is blocked", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const task = await createTask(request, bundle.leaderSession, bundle.team.id, bundle.member.id, uniqueSuffix(testInfo));
    await expectApiOk(request, `/tasks/${task.id}/accept`, { method: "POST", token: bundle.memberSession.token });

    await expectApiStatus(request, `/tasks/${task.id}/evidence/link`, 422, {
      method: "POST",
      token: bundle.memberSession.token,
      data: { title: "bad", url: "ftp://not-allowed.example.test" },
    });

    await expectApiStatus(request, `/tasks/${task.id}/evidence/file`, 422, {
      method: "POST",
      token: bundle.memberSession.token,
      multipart: {
        title: "Invalid evidence",
        file: { name: "malware.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("bad") },
      },
    });

    await expectApiOk(request, `/tasks/${task.id}/evidence/link`, {
      method: "POST",
      token: bundle.memberSession.token,
      data: { title: "Working evidence", url: "https://example.com/work" },
    });
    await expectApiOk(request, `/tasks/${task.id}/submit-review`, { method: "POST", token: bundle.memberSession.token });
    const rejected = await expectApiOk<any>(request, `/tasks/${task.id}/reject`, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { reviewComment: "Please add a clearer explanation and retest the edge cases." },
    });
    expect(["TODO", "IN_PROGRESS"]).toContain(rejected.data.status);
  });

  test("TA sprint evaluation and admin review paths are validated", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const ta = await assignSeedTa(request, bundle.team.id, bundle.leaderSession.token);
    const sprint = await createSprint(request, bundle.leaderSession, bundle.team.id, uniqueSuffix(testInfo));

    const evaluation = await expectApiOk<any>(request, `/sprints/${sprint.id}/evaluations/me`, {
      method: "PUT",
      token: ta.token,
      data: {
        status: "SUBMITTED",
        feedback: "Good sprint rhythm and visible progress across tasks.",
        criteria: {
          planningQuality: 17,
          taskCompletion: 16,
          progressConsistency: 15,
          teamCollaboration: 18,
          deadlineCommitment: 16,
        },
      },
    });
    expect(evaluation.data.status).toBe("SUBMITTED");

    const admin = await loginApi(request, seedUsers.admin.email);
    await expectApiOk(request, `/sprints/${sprint.id}/evaluations/${evaluation.data.id}/review`, {
      method: "PATCH",
      token: admin.token,
      data: { status: "APPROVED", reviewComment: "Evaluation accepted.", earlyEvaluation: true },
    });
  });

  test("no-team and unrelated team users are blocked from task and sprint actions", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const outsiderBundle = await createTeamWithAcceptedMember(request, testInfo);
    const task = await createTask(request, bundle.leaderSession, bundle.team.id, bundle.member.id, uniqueSuffix(testInfo));

    await expectApiStatus(request, "/tasks", 403, {
      method: "POST",
      token: outsiderBundle.memberSession.token,
      data: {
        teamId: bundle.team.id,
        title: "Bad task",
        priority: "MEDIUM",
        startDate: "2026-06-21",
        endDate: "2026-06-25",
        assigneeUserId: bundle.member.id,
      },
    });

    await expectApiStatus(request, `/tasks/${task.id}/accept`, 403, {
      method: "POST",
      token: outsiderBundle.memberSession.token,
    });
  });

  test("task GitHub bootstrap/open PR/resync fail gracefully without a real provider", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const task = await createTask(request, bundle.leaderSession, bundle.team.id, bundle.member.id, uniqueSuffix(testInfo));

    await expectApiStatus(request, `/tasks/${task.id}/github/bootstrap`, [400, 409, 422, 503], {
      method: "POST",
      token: bundle.leaderSession.token,
    });
    await expectApiStatus(request, `/tasks/${task.id}/github/open-pr`, [400, 409, 422, 503], {
      method: "POST",
      token: bundle.memberSession.token,
      data: { title: "E2E PR", body: "Provider failure should be graceful.", base: "main" },
    });
    await expectApiStatus(request, `/tasks/${task.id}/github/resync`, [400, 409, 422, 503], {
      method: "POST",
      token: bundle.leaderSession.token,
    });
  });
});
