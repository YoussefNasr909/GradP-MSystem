import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FallbackState } from "@/components/feedback/fallback-state"

const backMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: backMock,
  }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe("FallbackState", () => {
  beforeEach(() => {
    backMock.mockClear()
  })

  it("renders a not-found state with link and back actions", () => {
    render(
      <FallbackState
        kind="not-found"
        eyebrow="Missing route"
        title="Project page not found"
        description="The requested project page does not exist."
        helperText="Go back or open the dashboard."
        actions={[
          { kind: "link", href: "/dashboard", label: "Open Dashboard" },
          { kind: "back", label: "Go Back", variant: "outline" },
        ]}
      />,
    )

    expect(screen.getByRole("heading", { name: "Project page not found" })).toBeInTheDocument()
    expect(screen.getByText("The requested project page does not exist.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /open dashboard/i })).toHaveAttribute("href", "/dashboard")

    fireEvent.click(screen.getByRole("button", { name: /go back/i }))
    expect(backMock).toHaveBeenCalledTimes(1)
  })

  it("runs the retry callback for error states", () => {
    const onRetry = vi.fn()

    render(
      <FallbackState
        kind="error"
        mode="panel"
        title="Could not load submissions"
        description="The backend returned an unexpected response."
        actions={[{ kind: "retry", label: "Try Again" }]}
        onRetry={onRetry}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
