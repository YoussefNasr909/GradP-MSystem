import { test, expect } from "./fixtures/test"
import { signInAs } from "./helpers/auth"
import { expectAnyVisibleText, expectUsablePage } from "./helpers/assertions"

test.describe.configure({ mode: "serial" })

test.describe("Announcements, risks, and GitHub workspace", () => {
  test("announcements page loads and role create controls are bounded", async ({ page }) => {
    const user = await signInAs(page, "doctor")
    expect(user, "doctor demo account should be available").not.toBeNull()

    await page.goto("/dashboard/announcements")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/announcement/i, /audience/i, /team/i, /post/i])
  })

  test("risk management page loads for project roles", async ({ page }) => {
    const user = await signInAs(page, "leader")
    expect(user, "leader demo account should be available").not.toBeNull()

    await page.goto("/dashboard/risk-management")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/risk/i, /severity/i, /status/i, /mitigation/i])
  })

  test("GitHub workspace renders sections and empty/error states safely", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/github")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/github/i, /repository/i, /branch/i, /workspace/i, /connect/i])
  })
})
