import { test as base, expect } from "@playwright/test"

const seriousConsolePatterns = [
  /Encountered two children with the same key/i,
  /Each child in a list should have a unique/i,
  /Hydration failed/i,
  /Minified React error/i,
  /Maximum update depth exceeded/i,
  /Unhandled Runtime Error/i,
  /Failed to compile/i,
  /TypeError:/i,
  /ReferenceError:/i,
  /Cannot read properties/i,
]

const ignoredConsolePatterns = [
  /Download the React DevTools/i,
  /favicon\.ico/i,
  /ResizeObserver loop/i,
]

export const test = base.extend({
  page: async ({ page }, run) => {
    const seriousErrors: string[] = []

    page.on("console", (message) => {
      const text = message.text()
      if (ignoredConsolePatterns.some((pattern) => pattern.test(text))) return
      if (message.type() === "error" && seriousConsolePatterns.some((pattern) => pattern.test(text))) {
        seriousErrors.push(`[console:${message.type()}] ${text}`)
      }
    })

    page.on("pageerror", (error) => {
      const message = error.message
      if (!ignoredConsolePatterns.some((pattern) => pattern.test(message))) {
        seriousErrors.push(`[pageerror] ${message}`)
      }
    })

    await run(page)

    expect(seriousErrors, `Serious browser errors:\n${seriousErrors.join("\n")}`).toEqual([])
  },
})

export { expect }
