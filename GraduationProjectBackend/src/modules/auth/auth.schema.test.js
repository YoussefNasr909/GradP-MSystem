import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  changePasswordSchema,
  disableTwoFactorSchema,
  oauthCompleteSchema,
  registerSchema,
  verifyEmailSchema,
} from "./auth.schema.js";

const validAcademicProfile = {
  phone: "+201001112222",
  academicId: "2024-0001",
  department: "COMPUTER_SCIENCE",
  academicYear: "YEAR_4",
  preferredTrack: "FULLSTACK_DEVELOPMENT",
};

describe("auth schemas", () => {
  it("accepts valid student registration and normalizes academic id", () => {
    const result = registerSchema.safeParse({
      body: {
        firstName: "Mona",
        lastName: "Ali",
        email: "mona.ali@student.edu",
        ...validAcademicProfile,
        password: "demo123",
        confirmPassword: "demo123",
        acceptTerms: true,
        role: "STUDENT",
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.data.body.academicId, "20240001");
  });

  it("blocks privileged role injection and unchecked terms during registration", () => {
    const result = registerSchema.safeParse({
      body: {
        firstName: "Admin",
        lastName: "User",
        email: "admin-injection@student.edu",
        ...validAcademicProfile,
        password: "demo123",
        confirmPassword: "demo123",
        acceptTerms: false,
        role: "ADMIN",
      },
    });

    assert.equal(result.success, false);
    assert.match(JSON.stringify(result.error.issues), /Invalid input|expected true|STUDENT/);
  });

  it("requires strong matching passwords for change-password", () => {
    const weak = changePasswordSchema.safeParse({
      body: {
        currentPassword: "demo123",
        newPassword: "weakpass",
        confirmPassword: "weakpass",
      },
    });
    assert.equal(weak.success, false);
    assert.match(JSON.stringify(weak.error.issues), /uppercase|number|special/);

    const strong = changePasswordSchema.safeParse({
      body: {
        currentPassword: "demo123",
        newPassword: "StrongPass1!",
        confirmPassword: "StrongPass1!",
      },
    });
    assert.equal(strong.success, true);
  });

  it("requires either authenticator code or recovery code when disabling 2FA", () => {
    const missingSecondFactor = disableTwoFactorSchema.safeParse({
      body: {
        password: "StrongPass1!",
      },
    });
    assert.equal(missingSecondFactor.success, false);
    assert.match(JSON.stringify(missingSecondFactor.error.issues), /authenticator code or recovery code/);

    const withCode = disableTwoFactorSchema.safeParse({
      body: {
        password: "StrongPass1!",
        code: "123456",
      },
    });
    assert.equal(withCode.success, true);
  });

  it("validates OTP shape for email verification", () => {
    assert.equal(verifyEmailSchema.safeParse({ body: { email: "student.edu", code: "123456" } }).success, false);
    assert.equal(verifyEmailSchema.safeParse({ body: { email: "student@test.edu", code: "12345" } }).success, false);
    assert.equal(verifyEmailSchema.safeParse({ body: { email: "student@test.edu", code: "123456" } }).success, true);
  });

  it("requires complete OAuth profile data and strong matching passwords", () => {
    const invalid = oauthCompleteSchema.safeParse({
      body: {
        ...validAcademicProfile,
        password: "demo123",
        confirmPassword: "demo123",
      },
    });
    assert.equal(invalid.success, false);
    assert.match(JSON.stringify(invalid.error.issues), /uppercase|special/);

    const valid = oauthCompleteSchema.safeParse({
      body: {
        ...validAcademicProfile,
        password: "StrongPass1!",
        confirmPassword: "StrongPass1!",
      },
    });
    assert.equal(valid.success, true);
    assert.equal(valid.data.body.academicId, "20240001");
  });
});
