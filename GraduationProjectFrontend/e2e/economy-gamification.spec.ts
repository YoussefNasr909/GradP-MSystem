import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginApi, loginByApi } from "./utils/auth";
import { assertLoadedOrBlocked } from "./utils/guards";
import { createTeamWithAcceptedMember } from "./utils/teams";
import { adminSession, createUser, uniqueSuffix } from "./utils/users";

function listFrom<T = any>(payload: any, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key] as T[];
  }
  return [];
}

test.describe("economy and gamification", () => {
  test("XP overview, history, badges, team summary, leaderboards, and process trigger match the current gamification API", async ({
    page,
    request,
  }, testInfo) => {
    const admin = await loginApi(request, seedUsers.admin.email);
    const bundle = await createTeamWithAcceptedMember(request, testInfo);

    const overview = await expectApiOk<any>(request, "/gamification/me", { token: bundle.memberSession.token });
    expect(JSON.stringify(overview.data)).toMatch(/xp|level|balance|badges/i);

    await expectApiOk(request, "/gamification/me/history?page=1&limit=10", { token: bundle.memberSession.token });
    await expectApiOk(request, "/gamification/me/badges", { token: bundle.memberSession.token });
    await expectApiOk(request, `/gamification/team/${bundle.team.id}`, { token: bundle.leaderSession.token });
    await expectApiOk(request, `/gamification/team/${bundle.team.id}/history?page=1&limit=10`, {
      token: bundle.leaderSession.token,
    });

    const leaderboard = await expectApiOk<any>(request, "/gamification/leaderboards?type=INDIVIDUAL_WEEKLY&limit=20", {
      token: bundle.memberSession.token,
    });
    expect(JSON.stringify(leaderboard.data)).toMatch(/items|leaderboard|rank|score/i);

    await expectApiStatus(request, "/gamification/admin/process-events", 403, {
      method: "POST",
      token: bundle.memberSession.token,
      data: {},
    });
    await expectApiOk(request, "/gamification/admin/process-events", {
      method: "POST",
      token: admin.token,
      data: { retryFailed: false, eventIds: [] },
    });

    await expectApiStatus(request, "/gamification/admin/cases", [200, 404, 405], { token: admin.token });
    test.info().annotations.push({
      type: "TODO",
      description:
        "Latest main removed the previous gamification admin cases/adjustments/audit/snapshot endpoints and dashboard page. Coverage now verifies the remaining process-events admin trigger plus public/user gamification APIs.",
    });

    await loginByApi(page, request, bundle.member.email, "/dashboard/gamification");
    await assertLoadedOrBlocked(page);
  });

  test("economy quests/rewards list safely, and purchase/equip/idempotency are verified when seed data allows it", async ({
    page,
    request,
  }, testInfo) => {
    const admin = await adminSession(request);
    const student = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-coins`);
    const studentSession = await loginApi(request, student.email, student.password);

    const overview = await expectApiOk<any>(request, "/economy/me", { token: studentSession.token });
    expect(JSON.stringify(overview.data)).toMatch(/wallet|quests|rewards|transactions/i);

    const quests = await expectApiOk<any>(request, "/economy/quests", { token: studentSession.token });
    const questProgress = listFrom<any>(quests.data, ["items", "quests"]);
    const claimable = questProgress.find((progress: any) => progress.claimable || (progress.completedAt && !progress.claimedAt));
    if (claimable) {
      await expectApiOk(request, `/economy/quests/${claimable.id}/claim`, {
        method: "POST",
        token: studentSession.token,
      });
      await expectApiStatus(request, `/economy/quests/${claimable.id}/claim`, 409, {
        method: "POST",
        token: studentSession.token,
      });
    } else {
      test.info().annotations.push({
        type: "TODO",
        description:
          "No claimable quest progress existed in this run. Quest list and economy overview still verify current API availability.",
      });
    }

    const rewards = await expectApiOk<any>(request, "/economy/rewards", { token: studentSession.token });
    const wallet = rewards.data?.wallet ?? overview.data?.wallet ?? { balance: 0 };
    const rewardItems = listFrom<any>(rewards.data, ["items", "rewards"]);
    const affordableReward = rewardItems.find(
      (reward: any) => !reward.owned && reward.status === "ACTIVE" && reward.inventory !== 0 && Number(reward.cost ?? 0) <= Number(wallet.balance ?? 0),
    );

    if (affordableReward) {
      const purchase = await expectApiOk<any>(request, `/economy/rewards/${affordableReward.id}/purchase`, {
        method: "POST",
        token: studentSession.token,
      });
      const purchaseItem = purchase.data?.purchase ?? purchase.data;
      expect(purchaseItem.rewardItemId ?? purchaseItem.rewardItem?.id).toBe(affordableReward.id);

      await expectApiOk(request, `/economy/purchases/${purchaseItem.id}/equip`, {
        method: "PATCH",
        token: studentSession.token,
        data: { equipped: true },
      });
      await expectApiStatus(request, `/economy/rewards/${affordableReward.id}/purchase`, 409, {
        method: "POST",
        token: studentSession.token,
      });
    } else {
      test.info().annotations.push({
        type: "TODO",
        description:
          "No affordable unowned reward existed for this isolated student. Reward list coverage remains active; purchase/equip runs automatically when seed data exposes a valid item.",
      });
    }

    await expectApiOk(request, "/economy/transactions", { token: studentSession.token });
    await loginByApi(page, request, student.email, "/dashboard/gamification");
    await assertLoadedOrBlocked(page);
  });
});
