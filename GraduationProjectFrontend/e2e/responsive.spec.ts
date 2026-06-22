import { expect, test, type Page } from "@playwright/test";
import { loginByApi } from "./utils/auth";
import { seedUsers } from "./utils/constants";
import { assertLoadedBlockedOrBlankTodo, assertLoadedOrBlocked, assertPageUsable } from "./utils/guards";

test.describe("responsive mobile coverage", () => {
  test.describe.configure({ timeout: 90_000 });

  async function gotoMobileRoute(page: Page, route: string) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
        return;
      } catch (error) {
        if (attempt === 1) throw error;
        await page.waitForTimeout(1_000);
      }
    }
  }

  test("mobile login and dashboard navigation do not crash", async ({ page, request }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.locator("body")).toBeVisible();
    await loginByApi(page, request, seedUsers.studentNoTeam.email, "/dashboard");
    await assertPageUsable(page);
    await expect(page.viewportSize()?.width ?? 9999).toBeLessThanOrEqual(500);
  });

  test("mobile drawer/sidebar routes, search, and empty states render", async ({ page, request }) => {
    await loginByApi(page, request, seedUsers.leader.email, "/dashboard/search");
    await assertLoadedOrBlocked(page, [/search|find|results|empty/i]);

    const searchBox = page.getByRole("searchbox").or(page.getByPlaceholder(/search/i)).first();
    if (await searchBox.isVisible().catch(() => false)) {
      await searchBox.fill("doctor");
      await page.keyboard.press("Enter");
      await assertLoadedOrBlocked(page, [/doctor|results|no results|empty/i]);
    }

    for (const route of ["/dashboard/my-team", "/dashboard/tasks", "/dashboard/notifications"]) {
      await gotoMobileRoute(page, route);
      await assertLoadedBlockedOrBlankTodo(page, `${route} mobile smoke`, [
        /team|task|notification|empty|required|dashboard/i,
      ]);
    }
  });

  test("mobile team and support dialogs/pages expose accessible headings or fallbacks", async ({ page, request }) => {
    await loginByApi(page, request, seedUsers.studentNoTeam.email, "/dashboard/my-team");
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/my-team mobile smoke", [
      /team|leader|member|required|create|join/i,
    ]);

    await gotoMobileRoute(page, "/dashboard/support");
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/support mobile smoke", [/support|ticket|help|empty/i]);

    const dialogTrigger = page.getByRole("button", { name: /new|create|submit|ticket|join|team/i }).first();
    if (await dialogTrigger.isVisible().catch(() => false)) {
      await dialogTrigger.click();
      await expect(
        page.getByRole("dialog").or(page.getByRole("heading", { name: /new|create|ticket|team|join/i })).first(),
      ).toBeVisible();
    }
  });
});
