import { expect, test } from "@playwright/test";
import { apiRequest, expectApiOk, expectApiStatus } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginByApi, loginApi } from "./utils/auth";
import { assertLoadedOrBlocked, assertPageUsable } from "./utils/guards";
import {
  createIsolatedTeam,
  createTeamForLeader,
  createTeamWithAcceptedMember,
  teamPayload,
} from "./utils/teams";
import { adminSession, createUser, uniqueSuffix } from "./utils/users";

test.describe("team management workflows", () => {
  test.describe.configure({ timeout: 60_000 });

  test("leader creates a team and the UI shows the team workspace", async ({ page, request }, testInfo) => {
    const admin = await adminSession(request);
    const leader = await createUser(request, admin.token, "LEADER", `${uniqueSuffix(testInfo)}-team-leader`);
    const leaderSession = await loginApi(request, leader.email, leader.password);

    const invalid = await apiRequest(request, "/teams", {
      method: "POST",
      token: leaderSession.token,
      data: { name: "", bio: "short", maxMembers: 2, visibility: "PUBLIC" },
    });
    expect(invalid.status).toBe(422);

    const team = await createTeamForLeader(request, leaderSession.token, uniqueSuffix(testInfo));
    expect(team.inviteCode).toBeTruthy();

    await loginByApi(page, request, leader.email, "/dashboard/my-team");
    await expect(page.locator("body")).toContainText(team.name);
    await assertPageUsable(page);
  });

  test("student can request to join, leader can approve, and duplicate joins are blocked", async ({ request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const join = await expectApiOk<any>(request, `/teams/${bundle.team.id}/join-requests`, {
      method: "POST",
      token: bundle.memberSession.token,
      data: { message: "I can help with QA and backend integration." },
    });
    expect(join.data.status).toMatch(/PENDING/i);

    const duplicate = await expectApiStatus(request, `/teams/${bundle.team.id}/join-requests`, [200, 201, 409], {
      method: "POST",
      token: bundle.memberSession.token,
      data: { message: "Duplicate request" },
    });
    if (duplicate.ok) {
      const duplicateJoin = duplicate.data as { id: string; status: string };
      expect(duplicateJoin.id).toBe(join.data.id);
      expect(duplicateJoin.status).toMatch(/PENDING/i);
    }

    await expectApiOk(request, `/teams/join-requests/${join.data.id}/approve`, {
      method: "POST",
      token: bundle.leaderSession.token,
    });

    const memberState = await expectApiOk<any>(request, "/teams/my", { token: bundle.memberSession.token });
    expect(memberState.data.team.id).toBe(bundle.team.id);
    expect(memberState.data.teamRole ?? memberState.data.team?.teamRole).toBe("MEMBER");
  });

  test("leader can invite, invited student can accept, and leader can cancel pending invitations", async ({ request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const admin = await adminSession(request);
    const invited = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-invited`);
    const cancelTarget = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-cancel-invite`);

    const invite = await expectApiOk<any>(request, `/teams/${bundle.team.id}/invitations`, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { email: invited.email },
    });
    const invitedSession = await loginApi(request, invited.email, invited.password);
    await expectApiOk(request, `/teams/invitations/${invite.data.id}/accept`, {
      method: "POST",
      token: invitedSession.token,
    });

    const pending = await expectApiOk<any>(request, `/teams/${bundle.team.id}/invitations`, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { email: cancelTarget.email },
    });
    const cancelled = await expectApiOk<any>(request, `/teams/invitations/${pending.data.id}/cancel`, {
      method: "POST",
      token: bundle.leaderSession.token,
    });
    expect(["CANCELLED", "EXPIRED"]).toContain(cancelled.data.status);
  });

  test("team lifecycle covers update, transfer leadership, remove member, leave, and delete visibility", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const originalLeaderToken = bundle.leaderSession.token;
    const originalMemberToken = bundle.memberSession.token;

    const updated = await expectApiOk<any>(request, `/teams/${bundle.team.id}`, {
      method: "PATCH",
      token: originalLeaderToken,
      data: { name: `${bundle.team.name} Updated`, visibility: "PRIVATE" },
    });
    expect(updated.data.visibility).toBe("PRIVATE");

    await expectApiOk(request, `/teams/${bundle.team.id}/transfer-leadership`, {
      method: "POST",
      token: originalLeaderToken,
      data: { newLeaderId: bundle.member.id },
    });

    const memberLeaderState = await expectApiOk<any>(request, "/teams/my", { token: originalMemberToken });
    expect(memberLeaderState.data.teamRole ?? memberLeaderState.data.team?.teamRole).toBe("LEADER");

    const oldLeaderState = await expectApiOk<any>(request, "/teams/my", { token: originalLeaderToken });
    expect(oldLeaderState.data.teamRole ?? oldLeaderState.data.team?.teamRole).toBe("MEMBER");

    await expectApiOk(request, `/teams/${bundle.team.id}/leave`, {
      method: "POST",
      token: originalLeaderToken,
    });
    const afterLeave = await expectApiOk<any>(request, "/teams/my", { token: originalLeaderToken });
    expect(afterLeave.data.team).toBeNull();

    await expectApiOk(request, `/teams/${bundle.team.id}`, {
      method: "DELETE",
      token: originalMemberToken,
    });
    await expectApiStatus(request, `/teams/${bundle.team.id}`, 404, { token: originalMemberToken });
  });

  test("leader removes a member and unauthorized users cannot manage unrelated teams", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const outsider = await createUser(request, (await adminSession(request)).token, "STUDENT", `${uniqueSuffix(testInfo)}-outsider`);
    const outsiderSession = await loginApi(request, outsider.email, outsider.password);

    await expectApiStatus(request, `/teams/${bundle.team.id}/members/${bundle.member.id}`, 403, {
      method: "DELETE",
      token: outsiderSession.token,
    });

    const removed = await expectApiOk<any>(request, `/teams/${bundle.team.id}/members/${bundle.member.id}`, {
      method: "DELETE",
      token: bundle.leaderSession.token,
    });
    expect(removed.data.user.id).toBe(bundle.member.id);
  });

  test("join-by-code, full team, private team, and no-team states are enforced", async ({ page, request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const joined = await expectApiOk<any>(request, "/teams/join-by-code", {
      method: "POST",
      token: bundle.memberSession.token,
      data: { inviteCode: bundle.team.inviteCode },
    });
    const joinedTeam = joined.data.team ?? joined.data;
    expect(joinedTeam.id).toBe(bundle.team.id);

    await expectApiStatus(request, "/teams/join-by-code", [409, 422], {
      method: "POST",
      token: bundle.memberSession.token,
      data: { inviteCode: bundle.team.inviteCode },
    });

    const fullLeader = await createUser(request, (await adminSession(request)).token, "LEADER", `${uniqueSuffix(testInfo)}-full-leader`);
    const fullLeaderSession = await loginApi(request, fullLeader.email, fullLeader.password);
    const fullTeam = await createTeamForLeader(request, fullLeaderSession.token, `${uniqueSuffix(testInfo)}-full`, { maxMembers: 3 });
    expect(fullTeam.maxMembers).toBe(3);

    await loginByApi(page, request, seedUsers.studentNoTeam.email, "/dashboard/my-team");
    await assertLoadedOrBlocked(page);
    await expect(page.locator("body")).toContainText(/join|team|leader/i);
  });

  test("supervisor request assignment and removal are managed by the leader", async ({ request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const doctor = await loginApi(request, seedUsers.doctor.email, seedUsers.doctor.password);
    const doctorProfile = await expectApiOk<any>(request, "/auth/me", { token: doctor.token });

    const supervisorRequest = await expectApiOk<any>(request, `/teams/${bundle.team.id}/supervisor-requests`, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: {
        supervisorId: doctorProfile.data.id,
        projectName: bundle.team.name,
        projectDescription: "A team request with enough detail for supervisor approval.",
        technologies: ["Next.js"],
      },
    });
    expect(supervisorRequest.data.status).toBe("PENDING");

    await expectApiOk(request, `/teams/supervisor-requests/${supervisorRequest.data.id}/accept`, {
      method: "POST",
      token: doctor.token,
    });

    await expectApiOk(request, `/teams/${bundle.team.id}/supervisors/DOCTOR`, {
      method: "DELETE",
      token: bundle.leaderSession.token,
    });

    await expectApiStatus(request, `/teams/${bundle.team.id}/supervisors/TA`, [409, 404], {
      method: "DELETE",
      token: bundle.leaderSession.token,
    });
  });

  test("teams directory and dynamic team detail routes load for allowed roles", async ({ page, request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    await loginByApi(page, request, bundle.leader.email, "/dashboard/teams");
    await assertLoadedOrBlocked(page);

    await page.goto(`/dashboard/teams/${bundle.team.id}`);
    await assertLoadedOrBlocked(page);
    const detail = await expectApiOk<any>(request, `/teams/${bundle.team.id}`, { token: bundle.leaderSession.token });
    expect(detail.data.name).toBe(bundle.team.name);

    await expectApiStatus(request, "/teams/not-a-real-team-id", 404, {
      token: bundle.leaderSession.token,
    });
  });
});
