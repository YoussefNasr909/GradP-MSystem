import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginApi, loginByApi } from "./utils/auth";
import { assertLoadedOrBlocked } from "./utils/guards";
import { adminSession, createUser, uniqueSuffix } from "./utils/users";

function unwrapEntity<T = any>(payload: any, keys: string[]): T {
  for (const key of keys) {
    if (payload?.[key]) return payload[key] as T;
  }
  return payload as T;
}

test.describe("economy and gamification", () => {
  test("XP overview, leaderboards, admin cases, adjustments, audit logs, and snapshot/process triggers are covered", async ({ page, request }, testInfo) => {
    const admin = await loginApi(request, seedUsers.admin.email);
    const student = await createUser(request, (await adminSession(request)).token, "STUDENT", `${uniqueSuffix(testInfo)}-xp`);
    const studentSession = await loginApi(request, student.email, student.password);

    const overview = await expectApiOk<any>(request, "/gamification/me", { token: studentSession.token });
    expect(JSON.stringify(overview.data)).toMatch(/xp|level|balance|badges/i);

    const leaderboard = await expectApiOk<any>(request, "/gamification/leaderboards?type=INDIVIDUAL_WEEKLY&limit=20", {
      token: studentSession.token,
    });
    expect(JSON.stringify(leaderboard.data)).toMatch(/items|leaderboard|rank|score/i);

    await expectApiOk(request, "/gamification/admin/cases", { token: admin.token });
    await expectApiStatus(request, "/gamification/admin/cases/not-real/resolve", [404, 422], {
      method: "PATCH",
      token: admin.token,
      data: { decision: "APPROVE", resolution: "No real case exists for this smoke path." },
    });

    const adjustment = await expectApiOk<any>(request, "/gamification/admin/adjustments", {
      method: "POST",
      token: admin.token,
      data: {
        targetUserId: student.id,
        amount: 25,
        reason: "E2E manual XP adjustment request for controlled review.",
        sourceReference: "e2e",
      },
    });
    expect(adjustment.data.status).toBe("PENDING");
    await expectApiOk(request, `/gamification/admin/adjustments/${adjustment.data.id}/review`, {
      method: "PATCH",
      token: admin.token,
      data: { decision: "APPROVE", reviewComment: "Approved by E2E admin." },
    });
    await expectApiOk(request, "/gamification/admin/audit-logs", { token: admin.token });
    await expectApiOk(request, "/gamification/admin/process-events", { method: "POST", token: admin.token });
    await expectApiOk(request, "/gamification/admin/leaderboards/snapshots", {
      method: "POST",
      token: admin.token,
      data: { types: ["INDIVIDUAL_WEEKLY"] },
    });

    await loginByApi(page, request, seedUsers.admin.email, "/dashboard/gamification/admin");
    await assertLoadedOrBlocked(page);
  });

  test("economy quest/reward admin CRUD, purchase/equip, and duplicate purchase protection work", async ({ page, request }, testInfo) => {
    const admin = await loginApi(request, seedUsers.admin.email);
    const student = await createUser(request, (await adminSession(request)).token, "STUDENT", `${uniqueSuffix(testInfo)}-coins`);
    const studentSession = await loginApi(request, student.email, student.password);
    const suffix = uniqueSuffix(testInfo).replace(/[^A-Z0-9_]/gi, "_").toUpperCase();

    const quest = await expectApiOk<any>(request, "/economy/admin/quests", {
      method: "POST",
      token: admin.token,
      data: {
        code: `E2E_QUEST_${suffix}`.slice(0, 70),
        title: "E2E Quest",
        description: "Quest created by E2E coverage.",
        type: "MILESTONE",
        metric: "TASKS_DONE",
        targetValue: 1,
        coinReward: 0,
        isActive: true,
        sortOrder: 1,
      },
    });
    const questItem = unwrapEntity<any>(quest.data, ["quest", "item"]);
    expect(questItem.code).toContain("E2E_QUEST");
    await expectApiOk(request, `/economy/admin/quests/${questItem.id}`, {
      method: "PATCH",
      token: admin.token,
      data: {
        code: questItem.code,
        title: "E2E Quest",
        description: "Updated E2E quest.",
        type: "MILESTONE",
        metric: "TASKS_DONE",
        targetValue: 1,
        coinReward: 0,
        isActive: true,
        sortOrder: 1,
        metadata: null,
      },
    });

    const reward = await expectApiOk<any>(request, "/economy/admin/rewards", {
      method: "POST",
      token: admin.token,
      data: {
        code: `E2E_REWARD_${suffix}`.slice(0, 70),
        name: "E2E Reward",
        description: "Zero-cost reward for deterministic purchase tests.",
        type: "TITLE",
        cost: 0,
        status: "ACTIVE",
        inventory: null,
        imageUrl: null,
        sortOrder: 1,
        metadata: null,
      },
    });
    const rewardItem = unwrapEntity<any>(reward.data, ["reward", "item"]);
    await expectApiOk(request, `/economy/admin/rewards/${rewardItem.id}`, {
      method: "PATCH",
      token: admin.token,
      data: {
        code: rewardItem.code,
        name: "E2E Reward",
        description: "Updated E2E reward.",
        type: "TITLE",
        cost: 0,
        status: "ACTIVE",
        inventory: null,
        imageUrl: null,
        sortOrder: 1,
        metadata: null,
      },
    });

    const purchase = await expectApiOk<any>(request, `/economy/rewards/${rewardItem.id}/purchase`, {
      method: "POST",
      token: studentSession.token,
    });
    const purchaseItem = unwrapEntity<any>(purchase.data, ["purchase"]);
    expect(purchaseItem.rewardItemId ?? purchaseItem.rewardItem?.id).toBe(rewardItem.id);
    await expectApiOk(request, `/economy/purchases/${purchaseItem.id}/equip`, {
      method: "PATCH",
      token: studentSession.token,
      data: { equipped: true },
    });
    await expectApiStatus(request, `/economy/rewards/${rewardItem.id}/purchase`, 409, {
      method: "POST",
      token: studentSession.token,
    });

    const quests = await expectApiOk<any>(request, "/economy/quests", { token: studentSession.token });
    const questProgress = Array.isArray(quests.data) ? quests.data : quests.data.items ?? quests.data.quests ?? [];
    const claimable = questProgress.find((progress: any) => progress.completedAt && !progress.claimedAt);
    if (claimable) {
      await expectApiOk(request, `/economy/quests/${claimable.id}/claim`, { method: "POST", token: studentSession.token });
      await expectApiStatus(request, `/economy/quests/${claimable.id}/claim`, 409, {
        method: "POST",
        token: studentSession.token,
      });
    } else {
      test.info().annotations.push({
        type: "TODO",
        description:
          "No claimable quest progress existed in this run. Duplicate reward purchase covers economy idempotency; future seed should include one claimable quest progress row.",
      });
    }

    await expectApiOk(request, "/economy/me", { token: studentSession.token });
    await expectApiOk(request, "/economy/transactions", { token: studentSession.token });
    await loginByApi(page, request, student.email, "/dashboard/gamification");
    await assertLoadedOrBlocked(page);
  });
});
