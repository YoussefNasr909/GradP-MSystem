import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginApi, loginByApi } from "./utils/auth";
import { assertLoadedOrBlocked } from "./utils/guards";
import { createIsolatedTeam } from "./utils/teams";
import { adminSession, createUser, uniqueSuffix } from "./utils/users";

test.describe("supervisor request workflows", () => {
  test("leader sends Doctor and TA requests, supervisors accept/decline, duplicates are blocked", async ({ page, request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const doctor = await loginApi(request, seedUsers.doctor.email);
    const ta = await loginApi(request, seedUsers.ta.email);
    const doctorMe = await expectApiOk<any>(request, "/auth/me", { token: doctor.token });
    const taMe = await expectApiOk<any>(request, "/auth/me", { token: ta.token });

    const doctorRequest = await expectApiOk<any>(request, `/teams/${bundle.team.id}/supervisor-requests`, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: {
        supervisorId: doctorMe.data.id,
        projectName: bundle.team.name,
        projectDescription: "Doctor request with enough project detail.",
        technologies: ["React"],
      },
    });
    expect(doctorRequest.data.supervisorRole).toBe("DOCTOR");

    const duplicateDoctor = await expectApiStatus(request, `/teams/${bundle.team.id}/supervisor-requests`, [200, 201, 409], {
      method: "POST",
      token: bundle.leaderSession.token,
      data: {
        supervisorId: doctorMe.data.id,
        projectName: bundle.team.name,
        projectDescription: "Duplicate request should not be accepted.",
        technologies: ["React"],
      },
    });
    if (duplicateDoctor.ok) {
      const duplicateRequest = duplicateDoctor.data as { id: string; status: string };
      expect(duplicateRequest.id).toBe(doctorRequest.data.id);
      expect(duplicateRequest.status).toBe("PENDING");
    }

    await expectApiOk(request, `/teams/supervisor-requests/${doctorRequest.data.id}/accept`, {
      method: "POST",
      token: doctor.token,
    });

    const taRequest = await expectApiOk<any>(request, `/teams/${bundle.team.id}/supervisor-requests`, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: {
        supervisorId: taMe.data.id,
        projectName: bundle.team.name,
        projectDescription: "TA request with enough project detail.",
        technologies: ["Testing"],
      },
    });
    await expectApiOk(request, `/teams/supervisor-requests/${taRequest.data.id}/decline`, {
      method: "POST",
      token: ta.token,
    });

    await loginByApi(page, request, seedUsers.doctor.email, "/dashboard/my-team");
    await assertLoadedOrBlocked(page);
  });

  test("no-team, member, wrong-supervisor, and non-supervisor restrictions are enforced", async ({ request }, testInfo) => {
    const admin = await adminSession(request);
    const noTeamLeader = await createUser(request, admin.token, "LEADER", `${uniqueSuffix(testInfo)}-no-team-leader`);
    const noTeamLeaderSession = await loginApi(request, noTeamLeader.email, noTeamLeader.password);
    const bundle = await createIsolatedTeam(request, testInfo);
    const doctor = await loginApi(request, seedUsers.doctor.email);
    const doctorMe = await expectApiOk<any>(request, "/auth/me", { token: doctor.token });

    await expectApiStatus(request, `/teams/${bundle.team.id}/supervisor-requests`, 403, {
      method: "POST",
      token: bundle.memberSession.token,
      data: { supervisorId: doctorMe.data.id, projectName: "Bad", projectDescription: "Member cannot request", technologies: ["x"] },
    });

    await expectApiStatus(request, `/teams/${bundle.team.id}/supervisor-requests`, [403, 404], {
      method: "POST",
      token: noTeamLeaderSession.token,
      data: { supervisorId: doctorMe.data.id, projectName: "Bad", projectDescription: "Wrong leader", technologies: ["x"] },
    });

    const req = await expectApiOk<any>(request, `/teams/${bundle.team.id}/supervisor-requests`, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: {
        supervisorId: doctorMe.data.id,
        projectName: bundle.team.name,
        projectDescription: "Valid request for wrong supervisor test.",
        technologies: ["x"],
      },
    });

    await expectApiStatus(request, `/teams/supervisor-requests/${req.data.id}/accept`, 403, {
      method: "POST",
      token: bundle.memberSession.token,
    });
  });
});
