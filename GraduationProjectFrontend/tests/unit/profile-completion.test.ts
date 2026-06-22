import { describe, expect, it } from "vitest"

import { isUserProfileIncomplete } from "@/lib/auth/profile-completion"

describe("isUserProfileIncomplete", () => {
  const completeStudent = {
    role: "member",
    phone: "+201001112222",
    departmentRaw: "COMPUTER_SCIENCE",
    academicYearRaw: "YEAR_4",
    preferredTrackRaw: "FULLSTACK_DEVELOPMENT",
    academicId: "20240001",
  }

  it("does not block anonymous state before auth resolves", () => {
    expect(isUserProfileIncomplete(null)).toBe(false)
    expect(isUserProfileIncomplete(undefined)).toBe(false)
  })

  it("accepts a complete student profile using raw backend enum fields", () => {
    expect(isUserProfileIncomplete(completeStudent)).toBe(false)
  })

  it("requires phone, department, academic year, preferred track, and academic id", () => {
    expect(isUserProfileIncomplete({ ...completeStudent, phone: "" })).toBe(true)
    expect(isUserProfileIncomplete({ ...completeStudent, departmentRaw: "" })).toBe(true)
    expect(isUserProfileIncomplete({ ...completeStudent, academicYearRaw: "" })).toBe(true)
    expect(isUserProfileIncomplete({ ...completeStudent, preferredTrackRaw: "" })).toBe(true)
    expect(isUserProfileIncomplete({ ...completeStudent, academicId: "" })).toBe(true)
  })

  it("falls back to studentCode and UI-friendly fields when raw fields are absent", () => {
    expect(
      isUserProfileIncomplete({
        role: "leader",
        phone: "+201001112222",
        department: "Computer Science",
        academicYear: "YEAR_4",
        preferredTrack: "FULLSTACK_DEVELOPMENT",
        studentCode: "20240002",
      }),
    ).toBe(false)
  })

  it("forces OAuth placeholder academic ids through complete-profile", () => {
    expect(isUserProfileIncomplete({ ...completeStudent, academicId: "OAUTH-google-123" })).toBe(true)
  })

  it("never requires academic profile fields for support users", () => {
    expect(isUserProfileIncomplete({ role: "SUPPORT" })).toBe(false)
    expect(isUserProfileIncomplete({ role: "support", academicId: "OAUTH-support" })).toBe(false)
  })
})
