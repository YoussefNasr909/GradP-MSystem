import { expect, test, type Page } from "@playwright/test";

import { loginByApi } from "./utils/auth";
import { seedUsers } from "./utils/constants";
import { assertPageUsable } from "./utils/guards";

async function expectRouteResponsive(page: Page, path: string, label: string) {
  const startedAt = Date.now();
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await assertPageUsable(page);
  const elapsedMs = Date.now() - startedAt;

  await expect(page.locator("body")).not.toContainText(/application error|runtime error|failed to load/i);
  await expect(page.locator("body")).not.toContainText(/loading your workspace forever/i);
  expect(elapsedMs, `${label} should become usable in a smoke-test budget`).toBeLessThan(60_000);
}

test.describe("performance smoke checks", () => {
  test.describe.configure({ timeout: 120_000 });

  test("public entry pages become usable quickly enough", async ({ page }) => {
    await expectRouteResponsive(page, "/", "landing page");
    await expectRouteResponsive(page, "/login", "login page");
  });

  test("authenticated dashboard pages do not hang", async ({ page, request }) => {
    await loginByApi(page, request, seedUsers.admin.email, "/dashboard");
    await assertPageUsable(page);

    await expectRouteResponsive(page, "/dashboard", "dashboard home");
    await expectRouteResponsive(page, "/dashboard/github", "GitHub workspace");
  });
});
