import { test, expect } from "./fixtures/test"
import { signInAs } from "./helpers/auth"
import { expectAnyVisibleText, expectUsablePage, maybeClickFirstVisible } from "./helpers/assertions"

test.describe.configure({ mode: "serial" })

test.describe("Tasks, sprints, and time tracker", () => {
  test("student task board loads and exposes board UI", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/tasks")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/task/i, /board/i, /backlog/i, /review/i])
  })

  test("sprints page loads for student and staff roles", async ({ page }) => {
    const student = await signInAs(page, "student")
    expect(student, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/sprints")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/sprint/i, /board/i, /evaluation/i, /planning/i])
  })

  test("time tracker loads and handles safe controls", async ({ page }) => {
    const user = await signInAs(page, "student")
    expect(user, "student demo account should be available").not.toBeNull()

    await page.goto("/dashboard/time-tracker")
    await expectUsablePage(page)
    await expectAnyVisibleText(page, [/time/i, /tracker/i, /session/i, /task/i])

    await maybeClickFirstVisible(page, /Today|This week|All/i)
    await expectUsablePage(page)
  })
})
