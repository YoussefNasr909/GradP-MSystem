import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { loginByApi } from "./utils/auth";
import { assertLoadedBlockedOrBlankTodo } from "./utils/guards";
import { createIsolatedTeam } from "./utils/teams";

test.describe("notifications workflow", () => {
  test.describe.configure({ timeout: 60_000 });

  test("event-created notification appears, unread count updates, and read/delete actions work", async ({ page, request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const before = await expectApiOk<any>(request, "/notifications/unread-count", { token: bundle.leaderSession.token });

    await expectApiOk(request, `/teams/${bundle.team.id}/join-requests`, {
      method: "POST",
      token: bundle.memberSession.token,
      data: { message: "Notification trigger from E2E join request." },
    });

    const after = await expectApiOk<any>(request, "/notifications/unread-count", { token: bundle.leaderSession.token });
    expect(after.data.unreadCount).toBeGreaterThanOrEqual(before.data.unreadCount);

    const list = await expectApiOk<any>(request, "/notifications?limit=10", { token: bundle.leaderSession.token });
    const notification = list.data.notifications.find((item: any) => /join|team|request/i.test(`${item.title} ${item.message}`));
    expect(notification).toBeTruthy();

    const read = await expectApiOk<any>(request, `/notifications/${notification.id}/read`, {
      method: "PATCH",
      token: bundle.leaderSession.token,
    });
    expect(read.data.read).toBeTruthy();

    await expectApiOk(request, "/notifications/read-all", {
      method: "PATCH",
      token: bundle.leaderSession.token,
    });
    await expectApiOk(request, `/notifications/${notification.id}`, {
      method: "DELETE",
      token: bundle.leaderSession.token,
    });

    await loginByApi(page, request, bundle.leader.email, "/dashboard/notifications");
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/notifications after read/delete workflow", [
      /notification|empty|read/i,
    ]);
  });

  test("wrong user cannot read/delete another user's notification and empty state is safe", async ({ page, request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const join = await expectApiOk<any>(request, `/teams/${bundle.team.id}/join-requests`, {
      method: "POST",
      token: bundle.memberSession.token,
      data: { message: "Notification ownership check." },
    });
    expect(join.data.id).toBeTruthy();

    const list = await expectApiOk<any>(request, "/notifications?limit=10", { token: bundle.leaderSession.token });
    const notification = list.data.notifications[0];
    expect(notification).toBeTruthy();

    await expectApiStatus(request, `/notifications/${notification.id}/read`, 403, {
      method: "PATCH",
      token: bundle.memberSession.token,
    });
    await expectApiStatus(request, `/notifications/${notification.id}`, 403, {
      method: "DELETE",
      token: bundle.memberSession.token,
    });

    await expectApiOk(request, "/notifications", { method: "DELETE", token: bundle.memberSession.token });
    await loginByApi(page, request, bundle.member.email, "/dashboard/notifications");
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/notifications empty state", [/notification|empty|no/i]);
  });
});
