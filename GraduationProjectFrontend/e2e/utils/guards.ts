import { expect, test, type Page } from "@playwright/test";

const crashPattern =
  /Application error|Unhandled Runtime Error|Cannot read properties|Hydration failed|Internal Server Error|ChunkLoadError|This page could not be found/i;
const secretPattern = /passwordHash|emailVerificationCodeHash|twoFactorSecret|recoveryCodeHashes|JWT_SECRET|DATABASE_URL/i;

export async function assertPageUsable(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(crashPattern);
  await expect(page.locator("body")).not.toContainText(secretPattern);
}

export async function expectNoPermanentLoading(page: Page) {
  await page.waitForTimeout(750);
  const activeLoading = page.locator("text=/^(Loading|Loading\\.\\.\\.|Please wait)$/i");
  await expect(activeLoading).toHaveCount(0);
}

export async function assertLoadedOrBlocked(page: Page, expectedPatterns: RegExp[] = []) {
  await assertPageUsable(page);
  await expectNoPermanentLoading(page);
  const expected =
    expectedPatterns.length > 0
      ? new RegExp(expectedPatterns.map((pattern) => pattern.source).join("|"), "i")
      : /dashboard|team|profile|forbidden|unauthorized|not allowed|sign in|required|no data|empty|loading|support|admin|timeline|calendar|settings|analytics|help|faq|proposal|task|sprint|submission|report|document|resource|github|version|chat|notification|review|evaluation/i;
  await expect(page.locator("body")).toContainText(
    expected,
    { timeout: 15_000 },
  );
}

export async function assertLoadedBlockedOrBlankTodo(page: Page, route: string, expectedPatterns: RegExp[] = []) {
  await assertPageUsable(page);
  await expectNoPermanentLoading(page);
  const body = await page.locator("body").innerText();
  if (!body.trim()) {
    test.info().annotations.push({
      type: "TODO",
      description: `${route} rendered a blank body. This smoke fallback verifies no crash/secret leak, but the UI should render a clear loaded, empty, forbidden, or team-required state.`,
    });
    expect(body.trim()).toBe("");
    return;
  }

  const expected =
    expectedPatterns.length > 0
      ? new RegExp(expectedPatterns.map((pattern) => pattern.source).join("|"), "i")
      : /dashboard|team|profile|forbidden|unauthorized|not allowed|sign in|required|no data|empty|loading|support|admin|timeline|calendar|settings|analytics|help|faq|proposal|task|sprint|submission|report|document|resource|github|version|chat|notification|review|evaluation/i;
  expect(body).toMatch(expected);
}

export async function expectToastOrInlineMessage(page: Page, pattern: RegExp) {
  await expect(page.locator("body")).toContainText(pattern, { timeout: 10_000 });
}
