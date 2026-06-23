import { test, expect } from "./fixtures/test"
import { clearAuth, loginThroughUi, logoutThroughUi, signInAs } from "./helpers/auth"
import { expectAccessBlocked, expectUsablePage } from "./helpers/assertions"
import { expectedRoleNavigation, type AppRole } from "./fixtures/users"
import { protectedRouteSamples } from "./fixtures/routes"

test.describe.configure({ mode: "serial" })

test.describe("Authentication", () => {
  test("login page loads correctly", async ({ page }) => {
    await page.goto("/login")

    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
    await expectUsablePage(page, { shell: false })
  })

  test("invalid login shows an error", async ({ page }) => {
    await page.goto("/login")
    await page.locator("#email").fill("admin@university.edu")
    await page.locator("#password").fill("wrong-password")
    await page.getByRole("button", { name: "Sign In" }).click()

    await expect(page.getByText("Invalid email or password")).toBeVisible()
  })

  test("valid login works through the UI", async ({ page }) => {
    await loginThroughUi(page, "admin@university.edu", "demo123")

    await expectUsablePage(page)
    await expect(page.getByText("User Management").first()).toBeVisible()
  })

  test("logout works through the UI", async ({ page }) => {
    const user = await signInAs(page, "admin")
    expect(user, "admin demo account should be available").not.toBeNull()

    await page.goto("/dashboard")
    await expectUsablePage(page)
    await logoutThroughUi(page)
    await expect(page.getByLabel("Email")).toBeVisible()
  })

  for (const route of protectedRouteSamples) {
    test(`logged-out users are redirected from ${route}`, async ({ page }) => {
      await clearAuth(page)
      await page.goto(route)

      await expectAccessBlocked(page)
    })
  }

  for (const role of ["admin", "doctor", "ta", "leader", "student"] satisfies AppRole[]) {
    test(`${role} lands on a role-appropriate dashboard`, async ({ page }) => {
      const user = await signInAs(page, role)
      expect(user, `${role} demo account should be available`).not.toBeNull()

      await page.goto("/dashboard")
      await expectUsablePage(page)

      for (const label of expectedRoleNavigation[role]) {
        await expect(page.getByText(label).first()).toBeVisible()
      }
    })
  }
})
