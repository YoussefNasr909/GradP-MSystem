import { test, expect } from "./fixtures/test"
import { signInAs } from "./helpers/auth"
import { expectAccessBlocked, expectAnyVisibleText, expectUsablePage } from "./helpers/assertions"

test.describe.configure({ mode: "serial" })

test.describe("Proposal flow", () => {
  test("student proposal list loads", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/proposals")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/proposal/i, /project/i, /review/i])
  })

  test("doctor can view proposal review states", async ({ page }) => {
    const user = await signInAs(page, "doctor")
    expect(user, "doctor demo account should be available").not.toBeNull()

    await page.goto("/dashboard/proposals")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/proposal/i, /doctor/i, /review/i, /approved/i, /pending/i])
  })

  test("new proposal form validates required fields", async ({ page }) => {
    const user = await signInAs(page, "leader")
    expect(user, "leader demo account should be available").not.toBeNull()

    await page.goto("/dashboard/proposals/new")
    await expectUsablePage(page)
    await expect(page.getByText("Create Project Proposal")).toBeVisible()

    await page.getByRole("button", { name: /Submit for Review/i }).click()
    await expect(page.getByText(/Title must be at least 5 characters/i)).toBeVisible()
  })

  test("students cannot open admin-only proposal review paths", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/admin")
    await expectAccessBlocked(page)
  })
})
