import { test, expect } from "./fixtures/test"
import { signInAs } from "./helpers/auth"
import { expectNoObviousBrokenContent, expectUsablePage } from "./helpers/assertions"

test.describe.configure({ mode: "serial" })

test.describe("Responsive mobile checks", () => {
  test("login page works on mobile viewport", async ({ page }) => {
    await page.goto("/login")

    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
    await expectNoObviousBrokenContent(page)
  })

  test("mobile dashboard opens with compact navigation controls", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard")
    await expectUsablePage(page, { shell: false })
    await expect(page.locator("main")).toBeVisible()
    await expect(page.getByRole("button").first()).toBeVisible()
  })

  test("mobile team page is not blank", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/my-team")
    await expectUsablePage(page, { shell: false })
  })
})
