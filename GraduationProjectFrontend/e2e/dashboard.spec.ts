import { test, expect } from "./fixtures/test"
import { signInAs } from "./helpers/auth"
import { expectAnyVisibleText, expectUsablePage } from "./helpers/assertions"
import type { AppRole } from "./fixtures/users"

test.describe.configure({ mode: "serial" })

test.describe("Dashboard and account areas", () => {
  for (const role of ["admin", "doctor", "ta", "leader", "student"] satisfies AppRole[]) {
    test(`${role} dashboard loads without crashing`, async ({ page }) => {
      const user = await signInAs(page, role)
      expect(user, `${role} demo account should be available`).not.toBeNull()

      await page.goto("/dashboard")
      await expectUsablePage(page)
      await expectAnyVisibleText(page, [/dashboard/i, /workspace/i, /overview/i])
    })
  }

  test("student can view profile/account areas", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/profile")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/profile/i, /account/i, /student/i])

    await page.goto("/dashboard/settings")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/settings/i, /account/i, /security/i])
  })

  test("admin can view management dashboard areas", async ({ page }) => {
    const user = await signInAs(page, "admin")
    expect(user, "admin demo account should be available").not.toBeNull()

    await page.goto("/dashboard/admin")
    await expectUsablePage(page)
    await expect(page.getByRole("heading", { name: "Admin User Management" })).toBeVisible()
  })
})
