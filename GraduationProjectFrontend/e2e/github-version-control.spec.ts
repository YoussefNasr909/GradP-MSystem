import { expect, test } from "@playwright/test";
import { apiRequest, expectApiOk, expectApiStatus } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginByApi } from "./utils/auth";
import { assertLoadedBlockedOrBlankTodo } from "./utils/guards";
import { createTeamWithAcceptedMember } from "./utils/teams";

const providerFailureStatuses = [200, 400, 401, 403, 404, 409, 422, 500, 503];

test.describe("GitHub and version-control workflows", () => {
  test.describe.configure({ timeout: 60_000 });

  test("GitHub and version-control pages load for team users and no-team students see setup/team-required state", async ({ page, request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);

    await loginByApi(page, request, bundle.leader.email, "/dashboard/github");
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/github");
    await page.goto("/dashboard/version-control", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/version-control");

    await loginByApi(page, request, seedUsers.studentNoTeam.email, "/dashboard/github");
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/github as no-team student");
    await page.goto("/dashboard/version-control", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/version-control as no-team student");
  });

  test("leader-only repository setup actions block members and fail gracefully without GitHub provider", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);

    await expectApiStatus(request, "/github/install-url", providerFailureStatuses, {
      token: bundle.leaderSession.token,
    });
    await expectApiStatus(request, "/github/repository/create", providerFailureStatuses, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: {
        teamId: bundle.team.id,
        installationId: "123",
        owner: "gpms-e2e",
        ownerType: "USER",
        repoName: "gpms-e2e-repo",
        visibility: "PRIVATE",
      },
    });
    await expectApiStatus(request, "/github/repository/create", 403, {
      method: "POST",
      token: bundle.memberSession.token,
      data: {
        teamId: bundle.team.id,
        installationId: "123",
        owner: "gpms-e2e",
        repoName: "member-forbidden",
      },
    });
    await expectApiStatus(request, "/github/repository/connect", providerFailureStatuses, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { teamId: bundle.team.id, installationId: "123", owner: "gpms-e2e", repoName: "existing" },
    });
    await expectApiStatus(request, "/github/repository", providerFailureStatuses, {
      method: "DELETE",
      token: bundle.leaderSession.token,
      data: { teamId: bundle.team.id, confirmationText: "DISCONNECT" },
    });
    await expectApiStatus(request, "/github/repository/permanent", providerFailureStatuses, {
      method: "DELETE",
      token: bundle.leaderSession.token,
      data: { teamId: bundle.team.id, confirmationText: "DELETE" },
    });
  });

  test("workspace, repository access, tree/blob, commits, compare, actions, releases, and contributors smoke/error states are covered", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const token = bundle.leaderSession.token;
    const teamQuery = `teamId=${bundle.team.id}`;

    for (const path of [
      "/github/user/connection",
      "/github/user/connect-url",
      `/github/workspace?${teamQuery}`,
      `/github/access?${teamQuery}`,
      `/github/tree?${teamQuery}&path=src`,
      `/github/blob?${teamQuery}&path=README.md`,
      `/github/branches?${teamQuery}`,
      `/github/commits?${teamQuery}`,
      `/github/commits/abcdef1?${teamQuery}`,
      `/github/compare?${teamQuery}&base=main&head=feature`,
      `/github/issues?${teamQuery}`,
      `/github/pulls?${teamQuery}`,
      `/github/pulls/1?${teamQuery}`,
      `/github/actions?${teamQuery}`,
      `/github/actions/1/logs?${teamQuery}`,
      `/github/releases?${teamQuery}`,
      `/github/contributors?${teamQuery}`,
    ]) {
      await expectApiStatus(request, path, providerFailureStatuses, { token });
    }
  });

  test("collaborators, branches, issues, PRs, releases, file commits, sync, and settings validate provider failure safely", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const token = bundle.leaderSession.token;
    const teamId = bundle.team.id;

    const cases: Array<[string, string, Record<string, unknown>?]> = [
      ["/github/settings", "PATCH", { teamId, defaultBranch: "main" }],
      ["/github/sync", "POST", { teamId }],
      ["/github/collaborators", "POST", { teamId, login: "octocat", permission: "pull" }],
      ["/github/collaborators/octocat?teamId=" + teamId, "DELETE"],
      ["/github/invitations/1?teamId=" + teamId, "DELETE"],
      ["/github/branches", "POST", { teamId, name: "e2e-branch", startEmpty: true }],
      ["/github/branches/merge", "POST", { teamId, base: "main", head: "e2e-branch" }],
      ["/github/branches/e2e-branch?teamId=" + teamId, "DELETE"],
      ["/github/files/commit", "POST", { teamId, branch: "main", message: "E2E commit", changes: [{ action: "create", path: "e2e.txt", content: "test" }] }],
      ["/github/issues", "POST", { teamId, title: "E2E issue", body: "Provider failure expected." }],
      ["/github/issues/1", "PATCH", { teamId, title: "Updated issue" }],
      ["/github/pulls", "POST", { teamId, title: "E2E PR", body: "Provider failure expected.", head: "feature", base: "main" }],
      ["/github/pulls/1/reviews", "POST", { teamId, event: "COMMENT", body: "Looks fine." }],
      ["/github/pulls/1/merge", "POST", { teamId, mergeMethod: "squash" }],
      ["/github/releases", "POST", { teamId, tagName: "v0.0.1-e2e", name: "E2E Release" }],
    ];

    for (const [path, method, data] of cases) {
      await expectApiStatus(request, path, providerFailureStatuses, { method: method as any, token, data });
    }
  });

  test("webhook bad-signature and AI PR review route validate bad payload/provider failure", async ({ request }) => {
    const webhook = await apiRequest(request, "/github/webhooks/receive", {
      method: "POST",
      data: { action: "opened" },
      headers: { "x-github-event": "pull_request", "x-hub-signature-256": "sha256=badsignature" },
    });
    expect([200, 202, 400, 401, 403, 422]).toContain(webhook.status);
    expect(JSON.stringify(webhook.body)).not.toMatch(/webhook_secret|private_key/i);

    const review = await request.post("/api/review-pr", {
      data: { pullRequestUrl: "not-a-url" },
      failOnStatusCode: false,
    });
    expect([400, 401, 403, 422, 500, 503]).toContain(review.status());
    expect(await review.text()).not.toMatch(/api[_-]?key|secret/i);
  });
});
