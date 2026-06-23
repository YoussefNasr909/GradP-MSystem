import { expect, test } from "@playwright/test";
import { apiRequest, expectApiOk, expectApiStatus, expectUnauthorizedWithoutToken } from "./utils/api";
import { API_BASE_URL, BACKEND_ORIGIN, seedUsers } from "./utils/constants";
import { loginApi } from "./utils/auth";
import { createTeamWithAcceptedMember } from "./utils/teams";
import { createProposal, createSprint, createTask, meetingPayload } from "./utils/workflows";

const protectedEndpoints = [
  "/users/me",
  "/teams/my",
  "/proposals",
  "/tasks",
  "/sprints",
  "/submissions",
  "/submission-comments/invalid",
  "/meetings",
  "/calendar/events",
  "/resources",
  "/documents",
  "/risks",
  "/announcements",
  "/notifications",
  "/settings/me",
  "/supervisor-notes",
  "/deadlines",
  "/discussions",
  "/chat/bootstrap",
  "/team-chats/bootstrap",
  "/economy/me",
  "/gamification/me",
  "/support/tickets",
  "/admin/logs/system",
  "/github/workspace",
  "/weekly-reports",
  "/rubric-templates",
];

test.describe("API module boundaries and hardening", () => {
  test("health and API ping use the expected backend base URLs", async ({ request }) => {
    const health = await request.get(`${BACKEND_ORIGIN}/health`, { failOnStatusCode: false });
    expect([200, 204]).toContain(health.status());
    const ping = await request.get(`${API_BASE_URL}/ping`, { failOnStatusCode: false });
    expect(ping.status()).toBe(200);
    await expect(ping.json()).resolves.toMatchObject({ ok: true });
  });

  test("missing, malformed, and role-mismatched tokens are rejected consistently", async ({ request }) => {
    for (const endpoint of protectedEndpoints) {
      await expectUnauthorizedWithoutToken(request, endpoint);
      await expectApiStatus(request, endpoint, [401, 403], {
        headers: { Authorization: "Bearer malformed.not-a-jwt" },
      });
    }

    const student = await loginApi(request, seedUsers.studentNoTeam.email);
    await expectApiStatus(request, "/admin/logs/system", 403, { token: student.token });
    await expectApiStatus(request, "/supervisor-notes?teamId=missing-team", 403, { token: student.token });
  });

  test("bad IDs, malformed payloads, duplicate actions, and deleted records are handled", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);

    await expectApiStatus(request, "/teams/not-a-real-team", 404, { token: bundle.leaderSession.token });
    await expectApiStatus(request, "/proposals/not-a-real-proposal", 404, { token: bundle.leaderSession.token });
    await expectApiStatus(request, "/tasks/not-a-real-task", 404, { token: bundle.leaderSession.token });
    await expectApiStatus(request, "/meetings/not-a-real-meeting", 404, { token: bundle.leaderSession.token });

    await expectApiStatus(request, "/proposals", 422, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { title: "" },
    });
    await expectApiStatus(request, "/meetings", 422, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { title: "", teamId: bundle.team.id },
    });

    const joinDuplicate = await apiRequest(request, `/teams/${bundle.team.id}/join-requests`, {
      method: "POST",
      token: bundle.memberSession.token,
      data: { message: "duplicate request" },
    });
    expect([400, 403, 409, 422]).toContain(joinDuplicate.status);
  });

  test("core workflow modules have smoke coverage through API setup", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const proposal = await createProposal(request, bundle.leaderSession, `api-${testInfo.workerIndex}-${Date.now()}`);
    expect(proposal.id).toBeTruthy();

    const sprint = await createSprint(request, bundle.leaderSession, bundle.team.id, `api-${testInfo.workerIndex}-${Date.now()}`);
    expect(sprint.status).toBe("PLANNED");

    const task = await createTask(
      request,
      bundle.leaderSession,
      bundle.team.id,
      bundle.member.id,
      `api-${testInfo.workerIndex}-${Date.now()}`,
    );
    expect(task.assigneeUserId ?? task.assignee?.id).toBeTruthy();

    const meetingWindow = meetingPayload(bundle.team.id, `api-${testInfo.workerIndex}`, { title: "API conflict check" });
    await expectApiOk(
      request,
      `/meetings/conflict-check?startAt=${encodeURIComponent(String(meetingWindow.startAt))}&endAt=${encodeURIComponent(
        String(meetingWindow.endAt),
      )}&userIds=${encodeURIComponent(bundle.leader.id)}`,
      { token: bundle.leaderSession.token },
    );
    await expectApiOk(request, "/notifications/unread-count", { token: bundle.leaderSession.token });
    await expectApiOk(request, "/calendar/events", { token: bundle.leaderSession.token });
  });

  test("GitHub, AI-adjacent, support, admin, economy, and gamification APIs fail safely without external providers", async ({ request }) => {
    const admin = await loginApi(request, seedUsers.admin.email);
    const leader = await loginApi(request, seedUsers.leader.email);

    for (const endpoint of [
      "/github/workspace",
      "/github/access",
      "/github/tree",
      "/github/blob?path=README.md",
      "/github/branches",
      "/github/commits",
      "/github/compare?base=main&head=feature/e2e",
      "/github/actions",
      "/github/actions/1/logs",
      "/github/releases",
      "/github/contributors",
    ]) {
      await expectApiStatus(request, endpoint, [200, 400, 403, 404, 409, 422, 502, 503], { token: leader.token });
    }

    await expectApiStatus(request, "/github/webhooks/receive", [400, 401, 403, 422], {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=bad", "x-github-event": "push" },
      data: { repository: { full_name: "bad/repo" } },
    });

    for (const endpoint of ["/support/summary", "/support/agents", "/economy/rewards", "/gamification/leaderboards"]) {
      await expectApiStatus(request, endpoint, [200, 403, 404], { token: admin.token });
    }

    await expectApiStatus(request, "/gamification/admin/process-events", [200, 400, 422], {
      method: "POST",
      token: admin.token,
      data: { retryFailed: false, eventIds: [] },
    });
    for (const endpoint of ["/gamification/admin/cases", "/gamification/admin/audit-logs", "/gamification/admin/leaderboards/snapshots"]) {
      await expectApiStatus(request, endpoint, [200, 201, 404, 405], { token: admin.token });
    }
  });

  test("login/reset-password rate-limit surfaces as success, validation, or 429 without crashing", async ({ request }) => {
    const attempts: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      const response = await apiRequest(request, "/auth/login", {
        method: "POST",
        data: { email: "rate-limit-e2e@example.test", password: "wrong-password", rememberMe: false },
      });
      attempts.push(response.status);
    }
    expect(attempts.every((status) => [400, 401, 422, 429].includes(status))).toBe(true);

    await expectApiStatus(request, "/auth/forgot-password", [200, 400, 404, 422, 429], {
      method: "POST",
      data: { email: "rate-limit-e2e@example.test" },
    });
  });
});
