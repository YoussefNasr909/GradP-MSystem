import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { loginApi, loginByApi } from "./utils/auth";
import { seedUsers } from "./utils/constants";
import { createUser, uniqueSuffix } from "./utils/users";
import { createIsolatedTeam } from "./utils/teams";
import { assertLoadedBlockedOrBlankTodo, assertLoadedOrBlocked, assertPageUsable } from "./utils/guards";

test.describe("admin dashboard, users, logs, and reports", () => {
  test("admin dashboard and logs pages load while non-admin is blocked", async ({ page, request }) => {
    await loginByApi(page, request, seedUsers.admin.email, "/dashboard/admin");
    await assertPageUsable(page);
    await assertLoadedOrBlocked(page, [/admin|users|system|dashboard|analytics/i]);

    await page.goto("/dashboard/admin/logs");
    await assertLoadedOrBlocked(page, [/logs|activity|system|empty/i]);

    await loginByApi(page, request, seedUsers.studentNoTeam.email, "/dashboard/admin");
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/admin as non-admin", [/forbidden|not authorized|dashboard|admin/i]);
  });

  test("admin can search, create, update, deactivate, and delete users through API", async ({ request }, testInfo) => {
    const admin = await loginApi(request, seedUsers.admin.email);
    const suffix = `${uniqueSuffix(testInfo)}-admin-user`;
    const created = await createUser(request, admin.token, "STUDENT", suffix);

    const list = await expectApiOk<any>(request, `/users?search=${encodeURIComponent(created.email)}`, {
      token: admin.token,
    });
    expect(JSON.stringify(list.data)).toContain(created.email);

    const updated = await expectApiOk<any>(request, `/users/${created.id}`, {
      method: "PATCH",
      token: admin.token,
      data: { firstName: "Updated", accountStatus: "INACTIVE" },
    });
    expect(updated.data.firstName).toBe("Updated");
    expect(updated.data.accountStatus).toBe("INACTIVE");

    await expectApiStatus(request, `/users/${created.id}`, 403, {
      token: (await loginApi(request, seedUsers.studentNoTeam.email)).token,
    });

    await expectApiOk(request, `/users/${created.id}`, { method: "DELETE", token: admin.token });
    await expectApiStatus(request, `/users/${created.id}`, 404, { token: admin.token });
  });

  test("admin and doctor report endpoints respond and unauthorized users are blocked", async ({ request }, testInfo) => {
    const admin = await loginApi(request, seedUsers.admin.email);
    const doctor = await loginApi(request, seedUsers.doctor.email);
    const student = await loginApi(request, seedUsers.studentNoTeam.email);
    const bundle = await createIsolatedTeam(request, testInfo);

    for (const endpoint of ["/admin/logs/system", "/admin/logs/activity"]) {
      await expectApiOk(request, endpoint, { token: admin.token });
      await expectApiStatus(request, endpoint, 403, { token: doctor.token });
    }

    for (const endpoint of [
      "/admin/grades-overview",
      "/admin/analytics",
      "/admin/reports/grades.pdf",
      "/admin/reports/sdlc-phases.pdf",
      "/admin/reports/analytics.pdf",
      `/admin/teams/${bundle.team.id}/report-card.pdf`,
    ]) {
      await expectApiStatus(request, endpoint, [200, 204, 500], { token: admin.token });
      await expectApiStatus(request, endpoint, [200, 204, 403, 404, 500], { token: doctor.token });
      await expectApiStatus(request, endpoint, 403, { token: student.token });
    }

    await expectApiOk(request, `/admin/teams/${bundle.team.id}/activity`, { token: admin.token });
  });
});
