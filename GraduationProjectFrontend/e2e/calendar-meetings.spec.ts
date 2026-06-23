import { test, expect } from "./fixtures/test"
import { signInAs } from "./helpers/auth"
import { expectAnyVisibleText, expectUsablePage, maybeClickFirstVisible } from "./helpers/assertions"

test.describe.configure({ mode: "serial" })

test.describe("Calendar and meetings", () => {
  test("calendar page loads", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/calendar")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/calendar/i, /month/i, /week/i, /event/i])
  })

  test("meetings page loads and create/view controls are safe", async ({ page }) => {
    const user = await signInAs(page, "doctor")
    expect(user, "doctor demo account should be available").not.toBeNull()

    await page.goto("/dashboard/meetings")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/meeting/i, /calendar/i, /schedule/i, /attendees/i])

    const opened = await maybeClickFirstVisible(page, /new meeting|create meeting|schedule/i)
    if (opened) {
      await expectAnyVisibleText(page, [/meeting/i, /title/i, /date/i, /team/i])
    }
  })
})
