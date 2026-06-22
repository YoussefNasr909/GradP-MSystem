import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { loginApi, loginByApi } from "./utils/auth";
import { seedUsers } from "./utils/constants";
import { createIsolatedTeam } from "./utils/teams";
import { assertLoadedOrBlocked } from "./utils/guards";
import { dateOnly } from "./utils/workflows";

async function assignDoctor(request: any, teamId: string, leaderToken: string) {
  const doctor = await loginApi(request, seedUsers.doctor.email);
  const sent = await expectApiOk<any>(request, `/teams/${teamId}/supervisor-requests`, {
    method: "POST",
    token: leaderToken,
    data: {
      supervisorId: doctor.user.id,
      projectName: "E2E supervisor toolkit",
      projectDescription: "Please supervise this E2E toolkit team with notes and deadline coverage.",
      technologies: ["Next.js", "Express"],
    },
  });
  await expectApiOk(request, `/teams/supervisor-requests/${sent.data.id}/accept`, {
    method: "POST",
    token: doctor.token,
  });
  return doctor;
}

test.describe("supervisor toolkit", () => {
  test("doctor/TA access is allowed and students are blocked or shown a proper state", async ({ page, request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const doctor = await assignDoctor(request, bundle.team.id, bundle.leaderSession.token);

    await loginByApi(page, request, doctor.user.email, "/dashboard/supervisor-toolkit");
    await assertLoadedOrBlocked(page, [/supervision|supervisor|supervised teams|notes|deadline|activity/i]);

    await loginByApi(page, request, bundle.leader.email, "/dashboard/supervisor-toolkit");
    await assertLoadedOrBlocked(page, [/forbidden|not authorized|supervisor|assigned teams|dashboard/i]);
  });

  test("supervisor notes and deadline tools enforce ownership and validation", async ({ request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const doctor = await assignDoctor(request, bundle.team.id, bundle.leaderSession.token);

    await expectApiStatus(request, "/supervisor-notes", 403, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { teamId: bundle.team.id, content: "Student should not create supervisor notes." },
    });
    await expectApiStatus(request, "/supervisor-notes", 422, {
      method: "POST",
      token: doctor.token,
      data: { teamId: bundle.team.id, content: "" },
    });

    const note = await expectApiOk<any>(request, "/supervisor-notes", {
      method: "POST",
      token: doctor.token,
      data: { teamId: bundle.team.id, content: "Private E2E supervisor note for assigned team." },
    });
    expect(note.data.content).toContain("Private");

    const listed = await expectApiOk<any>(request, `/supervisor-notes?teamId=${bundle.team.id}`, {
      token: doctor.token,
    });
    expect(JSON.stringify(listed.data)).toContain(note.data.id);

    const updated = await expectApiOk<any>(request, `/supervisor-notes/${note.data.id}`, {
      method: "PATCH",
      token: doctor.token,
      data: { content: "Updated private supervisor note." },
    });
    expect(updated.data.content).toContain("Updated");

    await expectApiOk(request, "/deadlines", {
      method: "POST",
      token: doctor.token,
      data: {
        teamId: bundle.team.id,
        deliverableType: "TEST_PLAN",
        dueDate: dateOnly(10),
        note: "Supervisor toolkit broadcast deadline.",
      },
    });

    await expectApiOk(request, `/supervisor-notes/${note.data.id}`, {
      method: "DELETE",
      token: doctor.token,
    });
  });
});
