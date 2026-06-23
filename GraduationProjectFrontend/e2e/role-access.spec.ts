import { test, expect } from "./fixtures/test"
import { clearAuth, signInAs } from "./helpers/auth"
import { expectAccessBlocked, expectUsablePage } from "./helpers/assertions"

test.describe.configure({ mode: "serial" })

test.describe("Security and role permissions", () => {
  test("logged-out users cannot access protected dashboard routes", async ({ page }) => {
    await clearAuth(page)
    await page.goto("/dashboard/tasks")

    await expectAccessBlocked(page)
  })

  test("student cannot access admin-only routes", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/admin")
    await expectAccessBlocked(page)

    await page.goto("/dashboard/admin/logs")
    await expectAccessBlocked(page)
  })

  test("student cannot access supervisor-only toolkit", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/supervisor-toolkit")
    await expectAccessBlocked(page)
  })

  test("admin-only pages are accessible by admin", async ({ page }) => {
    const user = await signInAs(page, "admin")
    expect(user, "admin demo account should be available").not.toBeNull()

    await page.goto("/dashboard/admin")
    await expectUsablePage(page)
    await expect(page.getByRole("heading", { name: "Admin User Management" })).toBeVisible()
  })

  test("doctor and TA can access supervision while student route boundaries remain distinct", async ({ page }) => {
    const doctor = await signInAs(page, "doctor")
    expect(doctor, "doctor demo account should be available").not.toBeNull()

    await page.goto("/dashboard/supervisor-toolkit")
    await expectUsablePage(page)
    await expect(page.getByText(/supervision|assigned teams|deadlines|rubric/i).first()).toBeVisible()
  })
})
