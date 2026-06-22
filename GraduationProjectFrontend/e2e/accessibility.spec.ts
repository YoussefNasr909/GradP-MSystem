import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { loginByApi } from "./utils/auth";
import { seedUsers } from "./utils/constants";
import { assertPageUsable } from "./utils/guards";

type PublicA11yRoute = {
  path: string;
  name: string;
  viewport?: { width: number; height: number };
};

async function expectNoBlockingA11yViolations(page: Page, pageName: string) {
  await page.waitForTimeout(1_500);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blockingViolations = results.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious"
  );

  expect(
    blockingViolations,
    `${pageName} has serious/critical accessibility violations:\n${JSON.stringify(
      blockingViolations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        nodes: violation.nodes.map((node) => node.target),
      })),
      null,
      2,
    )}`,
  ).toEqual([]);
}

test.describe("accessibility smoke checks", () => {
  const publicRoutes: PublicA11yRoute[] = [
    { path: "/", name: "landing page" },
    { path: "/login", name: "login page", viewport: { width: 390, height: 844 } },
    { path: "/register", name: "register page", viewport: { width: 390, height: 844 } },
  ];

  for (const route of publicRoutes) {
    test(`${route.name} has no serious or critical axe violations`, async ({ page }) => {
      if (route.viewport) {
        await page.setViewportSize(route.viewport);
      }

      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await assertPageUsable(page);
      await expectNoBlockingA11yViolations(page, route.name);
    });
  }

  test("admin dashboard shell has no serious or critical axe violations", async ({ page, request }) => {
    await loginByApi(page, request, seedUsers.admin.email, "/dashboard");
    await expectNoBlockingA11yViolations(page, "admin dashboard");
  });
});
