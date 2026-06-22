import { expect, type APIRequestContext, type TestInfo } from "@playwright/test";
import { DEFAULT_PASSWORD, enumValues, seedUsers, type BackendRole } from "./constants";
import { expectApiOk, expectApiStatus } from "./api";
import { loginApi, type ApiUser } from "./auth";

export type TestUser = ApiUser & {
  password: string;
};

export function uniqueSuffix(testInfo: TestInfo) {
  const project = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const title = testInfo.titlePath.slice(-2).join("-").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `${project}-${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}-${title}`.slice(0, 80);
}

export async function adminSession(request: APIRequestContext) {
  return loginApi(request, seedUsers.admin.email, seedUsers.admin.password);
}

export async function createUser(
  request: APIRequestContext,
  token: string,
  role: BackendRole,
  suffix: string,
  overrides: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    academicId: string;
    accountStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    department: string | null;
    academicYear: string | null;
    preferredTrack: string | null;
  }> = {},
): Promise<TestUser> {
  const safe = suffix.replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 56);
  const payload = {
    firstName: overrides.firstName ?? "E2E",
    lastName: overrides.lastName ?? role,
    email: overrides.email ?? `${role.toLowerCase()}.${safe}@e2e.gpms.test`,
    phone: overrides.phone ?? "01012345678",
    role,
    password: overrides.password ?? DEFAULT_PASSWORD,
    academicId: overrides.academicId ?? `E2E-${role}-${safe}`.slice(0, 50),
    accountStatus: overrides.accountStatus ?? "ACTIVE",
    department: overrides.department === undefined ? enumValues.department : overrides.department,
    academicYear: overrides.academicYear === undefined ? enumValues.academicYear : overrides.academicYear,
    preferredTrack: overrides.preferredTrack === undefined ? enumValues.preferredTrack : overrides.preferredTrack,
  };

  const result = await expectApiOk<ApiUser>(request, "/users", { method: "POST", token, data: payload });
  return { ...result.data, password: payload.password };
}

export async function ensureSupportUser(request: APIRequestContext, suffix: string) {
  const admin = await adminSession(request);
  const email = `support.e2e.${suffix.replace(/[^a-z0-9-]/gi, "").slice(0, 60)}@university.edu`;
  const create = await expectApiOk<ApiUser>(request, "/users", {
    method: "POST",
    token: admin.token,
    data: {
      firstName: "E2E",
      lastName: "Support",
      email,
      phone: "01012345678",
      role: "SUPPORT",
      password: DEFAULT_PASSWORD,
      academicId: `SUPPORT-E2E-${Date.now()}`.slice(0, 50),
      accountStatus: "ACTIVE",
      department: enumValues.department,
      academicYear: enumValues.academicYear,
      preferredTrack: enumValues.preferredTrack,
    },
  });
  expect(create.data.role).toBe("SUPPORT");
  return { ...create.data, password: DEFAULT_PASSWORD };
}

export async function switchMyRole(request: APIRequestContext, token: string, role: "STUDENT" | "LEADER") {
  const result = await expectApiOk<ApiUser>(request, "/users/me/role", {
    method: "PATCH",
    token,
    data: { role },
  });
  expect(result.data.role).toBe(role);
  return result.data;
}

export async function makeUniqueStudent(request: APIRequestContext, testInfo: TestInfo, role: "STUDENT" | "LEADER" = "STUDENT") {
  const admin = await adminSession(request);
  return createUser(request, admin.token, role, uniqueSuffix(testInfo));
}

export async function expectAdminCreationFallbackDocumented(request: APIRequestContext, token: string) {
  await expectApiStatus(request, "/users", [400, 401, 403, 422], {
    method: "POST",
    token,
    data: {},
  });
}

