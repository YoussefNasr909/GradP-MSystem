import { test, expect } from "./fixtures/test"
import { signInAs } from "./helpers/auth"
import { apiGet } from "./helpers/api"
import { expectAccessBlocked, expectAnyVisibleText, expectUsablePage } from "./helpers/assertions"

test.describe.configure({ mode: "serial" })

test.describe("Team flow", () => {
  test("student can view their team area or team setup state", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/my-team")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/team/i, /member/i, /join/i, /create/i, /invite/i])
  })

  test("leader can view their team management area", async ({ page }) => {
    const user = await signInAs(page, "leader")
    expect(user, "leader demo account should be available").not.toBeNull()

    await page.goto("/dashboard/my-team")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/team/i, /leader/i, /member/i, /supervisor/i])
  })

  test("team list and team detail load with members", async ({ page }) => {
    const user = await signInAs(page, "doctor")
    expect(user, "doctor demo account should be available").not.toBeNull()

    await page.goto("/dashboard/teams")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/team/i, /members/i, /supervisor/i])

    const teams = await apiGet<{ items: Array<{ id: string; name: string }> }>(
      page.request,
      "/teams?limit=1",
      user!.token,
    )
    test.skip(!teams?.items.length, "No team exists in the current database seed")

    await page.goto(`/dashboard/teams/${teams!.items[0].id}`)
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/members/i, /leader/i, /doctor/i, /teaching assistant|TA/i])
  })

  test("students are blocked from admin-only team management", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/admin")
    await expectAccessBlocked(page)
    await expect(page.getByRole("link", { name: "User Management", exact: true })).toHaveCount(0)
  })
})
