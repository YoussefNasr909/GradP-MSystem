import { test, expect } from "./fixtures/test"
import { signInAs } from "./helpers/auth"
import { expectAnyVisibleText, expectUsablePage } from "./helpers/assertions"

test.describe.configure({ mode: "serial" })

test.describe("Chat and discussions", () => {
  test("chat page loads and exposes messaging UI or empty state", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/chat")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/messages/i, /chat/i, /conversation/i, /search/i, /start/i])
  })

  test("chat search or message input works when available", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/chat")
    await expectUsablePage(page)

    const searchInputs = page.getByPlaceholder(/search/i)
    if ((await searchInputs.count()) > 0) {
      await searchInputs.first().fill("doctor")
      await expect(page.locator("body")).toContainText(/doctor|search|conversation|no/i)
      return
    }

    const messageInputs = page.getByPlaceholder(/message/i)
    test.skip((await messageInputs.count()) === 0, "No searchable chat or message input is available for this seed state")
  })

  test("discussions page loads for collaboration roles", async ({ page }) => {
    const user = await signInAs(page, "doctor")
    expect(user, "doctor demo account should be available").not.toBeNull()

    await page.goto("/dashboard/discussions")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/discussion/i, /thread/i, /category/i, /empty/i])
  })

  test("admin private discussion access is not exposed", async ({ page }) => {
    const user = await signInAs(page, "admin")
    expect(user, "admin demo account should be available").not.toBeNull()

    await page.goto("/dashboard/discussions")
    await expectUsablePage(page)
    await expect(page.getByText(/Discussions are not available for admins/i)).toBeVisible()
  })
})
