import { expect, type Page } from "@playwright/test"

export async function expectNoObviousBrokenContent(page: Page) {
  await expect
    .poll(async () => (await page.locator("body").innerText()).trim().length, {
      message: "page should not be blank",
      timeout: 10_000,
    })
    .toBeGreaterThan(20)

  const bodyText = await page.locator("body").innerText({ timeout: 10_000 })
  expect(bodyText, "page should not render raw undefined/NaN text").not.toMatch(/\b(undefined|NaN)\b/)
  expect(bodyText, "page should not show a raw runtime error").not.toMatch(
    /Application error|Unhandled Runtime Error|Failed to compile|TypeError:|ReferenceError:/i,
  )
}

export async function expectDashboardShell(page: Page) {
  await expect(page.locator("main")).toBeVisible()
  await expect(page.getByText("ProjectHub").first()).toBeVisible()
}

export async function expectUsablePage(page: Page, options: { shell?: boolean } = {}) {
  await page.waitForLoadState("domcontentloaded")
  await expect(page.locator("body")).toBeVisible()
  await expectNoObviousBrokenContent(page)
  if (options.shell !== false) await expectDashboardShell(page)
}

export async function expectAccessBlocked(page: Page) {
  await page.waitForLoadState("domcontentloaded")
  await page.waitForURL(/\/login/, { timeout: 5_000 }).catch(() => undefined)
  if (/\/login/.test(page.url())) {
    await expect(page.locator("#email")).toBeVisible()
    return
  }

  await expect(
    page.getByText(/access denied|not available|only administrators|only available|sign in required|not authorized/i).first(),
  ).toBeVisible()
}

export async function expectAnyVisibleText(page: Page, patterns: RegExp[]) {
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 })
  const matched = patterns.some((pattern) => pattern.test(bodyText))
  expect(matched, `Expected one of ${patterns.map(String).join(", ")} in page body`).toBe(true)
}

export async function maybeClickFirstVisible(page: Page, name: RegExp) {
  const locator = page.getByRole("button", { name })
  const count = await locator.count()
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index)
    if (await item.isVisible()) {
      await item.click()
      return true
    }
  }
  return false
}
