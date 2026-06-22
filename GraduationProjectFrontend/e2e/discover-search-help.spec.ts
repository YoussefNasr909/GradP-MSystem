import { expect, test } from "@playwright/test";
import { loginByApi } from "./utils/auth";
import { seedUsers } from "./utils/constants";
import { ensureSupportUser, uniqueSuffix } from "./utils/users";
import { assertLoadedBlockedOrBlankTodo, assertLoadedOrBlocked, assertPageUsable } from "./utils/guards";

const pages = [
  { path: "/dashboard/discover", expected: /discover|doctor|ta|supervisor|empty/i },
  { path: "/dashboard/search", expected: /search|results|empty/i },
  { path: "/dashboard/faq", expected: /faq|question|answer|empty/i },
  { path: "/dashboard/help", expected: /help|guide|support|empty/i },
];

test.describe("discover, search, FAQ, and help", () => {
  test.describe.configure({ timeout: 90_000 });

  test("lightweight pages load and filters/search handle empty state", async ({ page, request }, testInfo) => {
    await loginByApi(page, request, seedUsers.leader.email, "/dashboard/discover");

    for (const item of pages) {
      await page.goto(item.path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await assertLoadedBlockedOrBlankTodo(page, item.path, [item.expected]);
      const input = page.getByRole("searchbox").or(page.getByPlaceholder(/search|filter/i)).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(`zz-no-results-${testInfo.workerIndex}-${Date.now()}`);
        await page.keyboard.press("Enter");
        await assertLoadedOrBlocked(page, [/no results|empty|not found|search|filter/i]);
      }
    }
  });

  test("all major roles can open help surfaces without crashes", async ({ page, request }, testInfo) => {
    const support = await ensureSupportUser(request, uniqueSuffix(testInfo));
    const emails = [
      seedUsers.studentNoTeam.email,
      seedUsers.leader.email,
      seedUsers.doctor.email,
      seedUsers.ta.email,
      seedUsers.admin.email,
      support.email,
    ];

    for (const email of emails) {
      await loginByApi(page, request, email, "/dashboard/help");
      await assertPageUsable(page);
      const guide = await request.get("/help-guides/getting-started", { failOnStatusCode: false, maxRedirects: 0 });
      expect([200, 302, 307, 404]).toContain(guide.status());
    }
  });
});
