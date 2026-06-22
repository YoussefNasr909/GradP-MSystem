import { describe, expect, it } from "vitest"

import {
  formatRoleLabel,
  formatTeamStage,
  formatTeamVisibility,
  getAvatarInitial,
  getFullName,
  getTeamProgressFallback,
} from "@/lib/team-display"

describe("team display helpers", () => {
  it("formats backend enums into user-facing labels", () => {
    expect(formatTeamStage("IMPLEMENTATION")).toBe("Implementation")
    expect(formatTeamStage("MAINTENANCE")).toBe("Maintenance")
    expect(formatTeamVisibility("PUBLIC")).toBe("Public")
    expect(formatTeamVisibility("PRIVATE")).toBe("Private")
  })

  it("formats role labels for the route-access matrix roles", () => {
    expect(formatRoleLabel("ADMIN")).toBe("Admin")
    expect(formatRoleLabel("DOCTOR")).toBe("Doctor")
    expect(formatRoleLabel("TA")).toBe("TA")
    expect(formatRoleLabel("SUPPORT")).toBe("Support")
    expect(formatRoleLabel("LEADER")).toBe("Team Leader")
    expect(formatRoleLabel("STUDENT")).toBe("Student")
  })

  it("uses fullName, first/last name, email, then fallback for display names", () => {
    expect(getFullName({ fullName: "Team Atlas", firstName: "", lastName: "", email: "atlas@test.edu" })).toBe(
      "Team Atlas",
    )
    expect(getFullName({ fullName: "", firstName: "Mona", lastName: "Ali", email: "mona@test.edu" })).toBe("Mona Ali")
    expect(getFullName({ fullName: "", firstName: "", lastName: "", email: "fallback@test.edu" })).toBe(
      "fallback@test.edu",
    )
    expect(getFullName({ fullName: "", firstName: "", lastName: "", email: "" })).toBe("User")
  })

  it("derives avatar initials from the final display name", () => {
    expect(getAvatarInitial({ fullName: "Smart Campus", firstName: "", lastName: "", email: "" })).toBe("S")
    expect(getAvatarInitial({ fullName: "", firstName: "", lastName: "", email: "team@example.com" })).toBe("T")
  })

  it("provides deterministic fallback progress by team stage", () => {
    expect(getTeamProgressFallback({ stage: "REQUIREMENTS" })).toBe(15)
    expect(getTeamProgressFallback({ stage: "DESIGN" })).toBe(30)
    expect(getTeamProgressFallback({ stage: "IMPLEMENTATION" })).toBe(60)
    expect(getTeamProgressFallback({ stage: "TESTING" })).toBe(80)
    expect(getTeamProgressFallback({ stage: "DEPLOYMENT" })).toBe(95)
    expect(getTeamProgressFallback({ stage: "MAINTENANCE" })).toBe(100)
  })
})
