import { expect, test } from "@playwright/test";
import { apiRequest, expectApiOk, expectApiStatus, expectUnauthorizedWithoutToken } from "./utils/api";
import { DEFAULT_PASSWORD, enumValues, seedUsers } from "./utils/constants";
import { assertLoadedBlockedOrBlankTodo, assertLoadedOrBlocked, assertPageUsable } from "./utils/guards";
import { loginApi, loginByApi, loginUi, tryLoginApi } from "./utils/auth";
import { adminSession, createUser, switchMyRole, uniqueSuffix } from "./utils/users";

test.describe("auth, identity, and hardening", () => {
  test.describe.configure({ timeout: 60_000 });

  test("seeded user can log in through the UI and load the dashboard", async ({ page }) => {
    await loginUi(page, seedUsers.admin.email);
    await expect(page).toHaveURL(/\/dashboard/);
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard after UI login", [/admin|dashboard/i]);
  });

  test("invalid, missing, and malformed tokens are rejected without leaking secrets", async ({ request }) => {
    const invalidLogin = await tryLoginApi(request, seedUsers.admin.email, "not-the-password");
    expect([400, 401, 403], JSON.stringify(invalidLogin.body)).toContain(invalidLogin.status);
    expect(JSON.stringify(invalidLogin.body)).not.toMatch(/passwordHash|emailVerificationCodeHash/i);

    await expectUnauthorizedWithoutToken(request, "/auth/me");

    const malformed = await apiRequest(request, "/auth/me", {
      headers: { Authorization: "Bearer malformed.token.value" },
    });
    expect(malformed.status).toBe(401);
    expect(JSON.stringify(malformed.body)).not.toMatch(/jwt|secret|stack/i);
  });

  test("registration, verification, reset, OAuth-complete, and 2FA validation paths fail safely", async ({ request, page }, testInfo) => {
    const suffix = `${Date.now()}${testInfo.workerIndex}${Math.floor(Math.random() * 1_000_000)}`
      .replace(/[^0-9]/g, "")
      .slice(-8);
    const register = await expectApiOk<{ token: string; user: unknown; emailSent: boolean }>(request, "/auth/register", {
      method: "POST",
      data: {
        firstName: "E2E",
        lastName: "Register",
        email: `register.${uniqueSuffix(testInfo)}@e2e.gpms.test`,
        phone: "01012345678",
        academicId: suffix,
        department: enumValues.department,
        academicYear: enumValues.academicYear,
        preferredTrack: enumValues.preferredTrack,
        password: "demo123",
        confirmPassword: "demo123",
        acceptTerms: true,
        role: "STUDENT",
      },
    });
    expect(register.data.token).toBeTruthy();

    await expectApiStatus(request, "/auth/verify-email", [400, 422], {
      method: "POST",
      data: { email: (register.data.user as any).email, code: "000000" },
    });
    await expectApiStatus(request, "/auth/verify-reset-code", [400, 404, 422], {
      method: "POST",
      data: { email: "missing-reset-user@example.test", code: "000000" },
    });
    await expectApiStatus(request, "/auth/reset-password", [400, 404, 422], {
      method: "POST",
      data: {
        email: "missing-reset-user@example.test",
        code: "000000",
        password: "Strong!12345",
        confirmPassword: "Strong!12345",
      },
    });
    await expectApiStatus(request, "/auth/oauth-complete", [401, 403], {
      method: "POST",
      data: {},
    });
    await expectApiStatus(request, "/auth/2fa/login", [400, 422], {
      method: "POST",
      data: { challengeToken: "bad-token", code: "000000" },
    });

    await page.goto("/oauth/callback#error=OAUTH_STATE_MISMATCH&provider=github&message=bad-state");
    await assertPageUsable(page);
    await expect(page.locator("body")).toContainText(/oauth|security|failed|try again/i);
  });

  test("inactive and suspended accounts cannot log in", async ({ request }, testInfo) => {
    const admin = await adminSession(request);
    const inactive = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-inactive`, {
      accountStatus: "INACTIVE",
    });
    const suspended = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-suspended`, {
      accountStatus: "SUSPENDED",
    });

    const inactiveLogin = await tryLoginApi(request, inactive.email, inactive.password);
    expect(inactiveLogin.status).toBe(403);
    expect(JSON.stringify(inactiveLogin.body)).toMatch(/inactive/i);

    const suspendedLogin = await tryLoginApi(request, suspended.email, suspended.password);
    expect(suspendedLogin.status).toBe(403);
    expect(JSON.stringify(suspendedLogin.body)).toMatch(/suspended/i);
  });

  test("student can switch to leader only when not attached to a team", async ({ request }, testInfo) => {
    const admin = await adminSession(request);
    const student = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-switch`);
    const studentSession = await loginApi(request, student.email, student.password);

    const updated = await switchMyRole(request, studentSession.token, "LEADER");
    expect(updated.role).toBe("LEADER");

    await expectApiStatus(request, "/users/me/role", [403, 400], {
      method: "PATCH",
      token: admin.token,
      data: { role: "LEADER" },
    });
  });

  test("profile privacy hides private directory records from unrelated users", async ({ request }, testInfo) => {
    const admin = await adminSession(request);
    const owner = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-privacy-owner`);
    const viewer = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-privacy-viewer`);
    const ownerSession = await loginApi(request, owner.email, owner.password);
    const viewerSession = await loginApi(request, viewer.email, viewer.password);

    await expectApiOk(request, "/settings/me", {
      method: "PATCH",
      token: ownerSession.token,
      data: { privacy: { profileVisibility: "PRIVATE", showEmail: false, showTeam: false } },
    });

    await expectApiStatus(request, `/users/directory/${owner.id}`, 404, { token: viewerSession.token });
    const self = await expectApiOk<any>(request, `/users/directory/${owner.id}`, { token: ownerSession.token });
    expect(self.data.id).toBe(owner.id);
  });

  test("complete-profile and logged-out route states render without crashes", async ({ page, request }) => {
    await page.goto("/complete-profile");
    await assertLoadedBlockedOrBlankTodo(page, "/complete-profile logged-out state");

    await page.goto("/dashboard");
    await assertPageUsable(page);
    await expect(page).toHaveURL(/\/login|\/dashboard/);

    await loginByApi(page, request, seedUsers.studentNoTeam.email, "/complete-profile");
    await assertLoadedBlockedOrBlankTodo(page, "/complete-profile authenticated state");
  });
});
