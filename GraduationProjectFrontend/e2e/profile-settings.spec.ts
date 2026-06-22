import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { loginByApi, loginApi } from "./utils/auth";
import { assertLoadedOrBlocked } from "./utils/guards";
import { adminSession, createUser, uniqueSuffix } from "./utils/users";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

test.describe("profile, settings, and complete-profile workflows", () => {
  test("profile page loads and profile fields validate/update correctly", async ({ page, request }, testInfo) => {
    const admin = await adminSession(request);
    const user = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-profile`);
    const session = await loginApi(request, user.email, user.password);

    const updated = await expectApiOk<any>(request, "/users/me", {
      method: "PATCH",
      token: session.token,
      data: {
        firstName: "Updated",
        lastName: "Profile",
        phone: "01099999999",
        bio: "E2E profile bio.",
        githubUsername: "valid-user",
        linkedinUrl: "https://www.linkedin.com/in/e2e-profile",
      },
    });
    expect(updated.data.githubUsername).toBe("valid-user");

    await expectApiStatus(request, "/users/me", 422, {
      method: "PATCH",
      token: session.token,
      data: { githubUsername: "-bad" },
    });
    await expectApiStatus(request, "/users/me", 422, {
      method: "PATCH",
      token: session.token,
      data: { linkedinUrl: "not-a-url" },
    });

    await loginByApi(page, request, user.email, "/dashboard/profile");
    await assertLoadedOrBlocked(page);
  });

  test("avatar upload/remove validates type and size", async ({ request }, testInfo) => {
    const admin = await adminSession(request);
    const user = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-avatar`);
    const session = await loginApi(request, user.email, user.password);

    const avatar = await expectApiOk<any>(request, "/users/me/avatar", {
      method: "PATCH",
      token: session.token,
      multipart: {
        avatar: { name: "avatar.png", mimeType: "image/png", buffer: tinyPng },
      },
    });
    expect(avatar.data.avatarUrl).toMatch(/uploads\/avatars/i);

    await expectApiStatus(request, "/users/me/avatar", 422, {
      method: "PATCH",
      token: session.token,
      multipart: {
        avatar: { name: "avatar.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("bad") },
      },
    });

    await expectApiStatus(request, "/users/me/avatar", 422, {
      method: "PATCH",
      token: session.token,
      multipart: {
        avatar: { name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 1) },
      },
    });

    const removed = await expectApiOk<any>(request, "/users/me/avatar", {
      method: "DELETE",
      token: session.token,
    });
    expect(removed.data.avatarUrl).toBeNull();
  });

  test("settings, password validation, and delete-account confirmation are guarded", async ({ page, request }, testInfo) => {
    const admin = await adminSession(request);
    const user = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-settings`);
    const session = await loginApi(request, user.email, user.password);

    const settings = await expectApiOk<any>(request, "/settings/me", {
      method: "PATCH",
      token: session.token,
      data: {
        notifications: { weeklyDigest: true, taskReminders: false },
        appearance: { theme: "dark", compactMode: true },
        privacy: { profileVisibility: "TEAM_ONLY", showEmail: false },
        security: { loginAlerts: true, sessionTimeout: 45 },
      },
    });
    expect(settings.data.privacy.profileVisibility).toBe("TEAM_ONLY");

    await expectApiStatus(request, "/auth/change-password", 422, {
      method: "POST",
      token: session.token,
      data: { currentPassword: user.password, newPassword: "weak", confirmPassword: "weak" },
    });
    await expectApiStatus(request, "/users/me", 400, {
      method: "DELETE",
      token: session.token,
      data: { email: "wrong@example.test" },
    });

    await loginByApi(page, request, user.email, "/dashboard/settings");
    await assertLoadedOrBlocked(page);
  });

  test("complete-profile route and oauth-complete validation fail safely without external OAuth", async ({ page, request }) => {
    await page.goto("/complete-profile?reason=incomplete");
    await assertLoadedOrBlocked(page);

    await expectApiStatus(request, "/auth/oauth-complete", [401, 403], {
      method: "POST",
      data: {},
    });

    test.info().annotations.push({
      type: "TODO",
      description:
        "Full successful complete-profile requires a real OAuth-created placeholder account. Covered fallback: route smoke and oauth-complete auth/validation errors.",
    });
  });
});

