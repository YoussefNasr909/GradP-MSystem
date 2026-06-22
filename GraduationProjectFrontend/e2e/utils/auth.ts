import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { backendRoleToUiRole, DEFAULT_PASSWORD, type BackendRole } from "./constants";
import { apiRequest, expectApiOk } from "./api";
import { assertPageUsable } from "./guards";

export type ApiUser = {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  phone?: string | null;
  role: BackendRole;
  accountStatus?: string;
  academicId?: string | null;
  department?: string | null;
  academicYear?: string | null;
  preferredTrack?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  linkedinUrl?: string | null;
  githubUsername?: string | null;
  isEmailVerified?: boolean;
};

export type AuthSession = {
  token: string;
  user: ApiUser;
};

export async function loginApi(
  request: APIRequestContext,
  email: string,
  password = DEFAULT_PASSWORD,
): Promise<AuthSession> {
  const result = await expectApiOk<{ token?: string; accessToken?: string; user: ApiUser }>(request, "/auth/login", {
    method: "POST",
    data: { email, password, rememberMe: true },
  });
  const token = result.data.token ?? result.data.accessToken;
  expect(token, `Login response for ${email} did not include a token`).toBeTruthy();
  return { token: String(token), user: result.data.user };
}

export async function tryLoginApi(
  request: APIRequestContext,
  email: string,
  password = DEFAULT_PASSWORD,
) {
  return apiRequest<{ token?: string; accessToken?: string; user?: ApiUser }>(request, "/auth/login", {
    method: "POST",
    data: { email, password, rememberMe: true },
  });
}

export function mapApiUserToUiUser(user: ApiUser) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.fullName || user.email;
  return {
    id: user.id,
    name,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    email: user.email,
    phone: user.phone ?? undefined,
    role: backendRoleToUiRole(user.role),
    avatar: user.avatarUrl ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    studentCode: user.academicId ?? undefined,
    academicId: user.academicId ?? undefined,
    departmentRaw: user.department ?? null,
    academicYearRaw: user.academicYear ?? null,
    preferredTrackRaw: user.preferredTrack ?? null,
    department: user.department ?? undefined,
    academicYear: user.academicYear ?? undefined,
    preferredTrack: user.preferredTrack ?? undefined,
    bio: user.bio ?? undefined,
    linkedinUrl: user.linkedinUrl ?? undefined,
    githubUsername: user.githubUsername ?? undefined,
  };
}

export async function setAuthStorage(page: Page, session: AuthSession) {
  const uiUser = mapApiUserToUiUser(session.user);
  await page.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem(
        "gpms-auth",
        JSON.stringify({
          state: {
            currentUser: user,
            accessToken: token,
            rememberSession: true,
          },
          version: 0,
        }),
      );
    },
    { token: session.token, user: uiUser },
  );
}

export async function loginUi(page: Page, email: string, password = DEFAULT_PASSWORD) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const emailInput = page
    .locator("input#email, input[type='email'], input[placeholder*='email' i], input[placeholder*='university' i]")
    .first();
  try {
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
  } catch {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
  }

  await emailInput.fill(email);
  await page.locator("input#password, input[type='password'], input[placeholder*='password' i]").first().fill(password);
  await page.locator("button[type='submit']").first().click();
  try {
    await page.waitForURL(/\/dashboard|\/complete-profile/, { timeout: 20_000, waitUntil: "domcontentloaded" });
  } catch (error) {
    const successState = page.getByText(/login successful/i);
    if (!(await successState.isVisible().catch(() => false))) {
      throw error;
    }
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  }
  await assertPageUsable(page);
}

export async function loginByApi(
  page: Page,
  request: APIRequestContext,
  email: string,
  targetPath = "/dashboard",
): Promise<AuthSession> {
  const session = await loginApi(request, email);
  await setAuthStorage(page, session);
  await page.goto(targetPath, { waitUntil: "domcontentloaded" });
  await assertPageUsable(page);
  return session;
}
