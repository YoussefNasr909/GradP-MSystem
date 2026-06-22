import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { loginApi, loginByApi } from "./utils/auth";
import { seedUsers } from "./utils/constants";
import { createIsolatedTeam } from "./utils/teams";
import { assertLoadedOrBlocked } from "./utils/guards";
import { dateOnly } from "./utils/workflows";

test.describe("deadlines and timeline", () => {
  test("students can view deadlines and timeline, including empty states", async ({ page, request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const admin = await loginApi(request, seedUsers.admin.email);

    await expectApiOk(request, "/deadlines", {
      method: "POST",
      token: admin.token,
      data: {
        teamId: bundle.team.id,
        deliverableType: "SRS",
        dueDate: dateOnly(7),
        note: "Submit the reviewed SRS package.",
      },
    });

    const list = await expectApiOk<any>(request, `/deadlines?teamId=${bundle.team.id}`, {
      token: bundle.leaderSession.token,
    });
    expect(list.data.length).toBeGreaterThan(0);
    expect(JSON.stringify(list.data)).toContain("SRS");

    await loginByApi(page, request, bundle.leader.email, "/dashboard/timeline");
    await assertLoadedOrBlocked(page, [/timeline|deadline|empty|no deadlines/i]);

    await loginByApi(page, request, seedUsers.studentNoTeam.email, "/dashboard/timeline");
    await assertLoadedOrBlocked(page, [/timeline|empty|no team|required|deadline/i]);
  });

  test("admin/doctor deadline management and role restrictions are enforced", async ({ request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const admin = await loginApi(request, seedUsers.admin.email);
    const student = await loginApi(request, seedUsers.studentNoTeam.email);

    await expectApiStatus(request, "/deadlines", 403, {
      method: "POST",
      token: student.token,
      data: { teamId: bundle.team.id, deliverableType: "UML", dueDate: dateOnly(3) },
    });

    const overdue = await expectApiOk<any>(request, "/deadlines", {
      method: "POST",
      token: admin.token,
      data: {
        teamId: bundle.team.id,
        deliverableType: "UML",
        dueDate: dateOnly(-2),
        note: "Overdue test deadline.",
      },
    });
    expect(overdue.data.deliverableType).toBe("UML");

    const upcoming = await expectApiOk<any>(request, `/deadlines?teamId=${bundle.team.id}&upcoming=false`, {
      token: bundle.leaderSession.token,
    });
    expect(JSON.stringify(upcoming.data)).toContain(overdue.data.id);

    await expectApiOk(request, `/deadlines/${overdue.data.id}`, {
      method: "DELETE",
      token: admin.token,
    });
    const afterDelete = await expectApiOk<any>(request, `/deadlines?teamId=${bundle.team.id}`, {
      token: bundle.leaderSession.token,
    });
    expect(JSON.stringify(afterDelete.data)).not.toContain(overdue.data.id);
  });
});
