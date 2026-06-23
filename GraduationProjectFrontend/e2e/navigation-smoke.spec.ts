import { test, expect } from "./fixtures/test"
import { routeMatrix } from "./fixtures/routes"
import { signInAs } from "./helpers/auth"
import { expectUsablePage } from "./helpers/assertions"
import type { AppRole } from "./fixtures/users"

test.describe("Navigation smoke tests", () => {
  for (const role of Object.keys(routeMatrix) as AppRole[]) {
    for (const route of routeMatrix[role]) {
      test(`${role} can open ${route.label}`, async ({ page }) => {
        const user = await signInAs(page, role)
        expect(user, `${role} demo account should be available`).not.toBeNull()

        await page.goto(route.path)
        await expectUsablePage(page)
      })
    }
  }
})
