import { expect, type APIRequestContext, type TestInfo } from "@playwright/test";
import { DEFAULT_PASSWORD, seedUsers } from "./constants";
import { expectApiOk } from "./api";
import { loginApi, type ApiUser, type AuthSession } from "./auth";
import { adminSession, createUser, switchMyRole, uniqueSuffix } from "./users";

export type TeamBundle = {
  leader: ApiUser & { password: string };
  leaderSession: AuthSession;
  member: ApiUser & { password: string };
  memberSession: AuthSession;
  team: any;
};

export function teamPayload(suffix: string, overrides: Record<string, unknown> = {}) {
  return {
    name: `E2E Team ${suffix}`.slice(0, 110),
    bio: `A realistic graduation project team created for E2E coverage ${suffix}.`,
    stack: ["Next.js", "Express", "PostgreSQL"],
    maxMembers: 5,
    visibility: "PUBLIC",
    allowJoinRequests: true,
    ...overrides,
  };
}

export async function createTeamForLeader(request: APIRequestContext, leaderToken: string, suffix: string, overrides = {}) {
  const result = await expectApiOk<any>(request, "/teams", {
    method: "POST",
    token: leaderToken,
    data: teamPayload(suffix, overrides),
  });
  expect(result.data.name).toContain("E2E Team");
  return result.data;
}

export async function createIsolatedTeam(request: APIRequestContext, testInfo: TestInfo): Promise<TeamBundle> {
  const admin = await adminSession(request);
  const suffix = uniqueSuffix(testInfo);
  const leader = await createUser(request, admin.token, "LEADER", `${suffix}-leader`);
  const member = await createUser(request, admin.token, "STUDENT", `${suffix}-member`);
  const leaderSession = await loginApi(request, leader.email, leader.password);
  const memberSession = await loginApi(request, member.email, member.password);
  const team = await createTeamForLeader(request, leaderSession.token, suffix);
  return { leader, leaderSession, member, memberSession, team };
}

export async function createTeamWithAcceptedMember(request: APIRequestContext, testInfo: TestInfo) {
  const bundle = await createIsolatedTeam(request, testInfo);
  const join = await expectApiOk<any>(request, `/teams/${bundle.team.id}/join-requests`, {
    method: "POST",
    token: bundle.memberSession.token,
    data: { message: "I can cover backend automation and documentation." },
  });
  await expectApiOk(request, `/teams/join-requests/${join.data.id}/approve`, {
    method: "POST",
    token: bundle.leaderSession.token,
  });
  const refreshed = await expectApiOk<any>(request, `/teams/${bundle.team.id}`, { token: bundle.leaderSession.token });
  return { ...bundle, team: refreshed.data, joinRequest: join.data };
}

export async function createSeededLeaderSession(request: APIRequestContext) {
  const session = await loginApi(request, seedUsers.leader.email, DEFAULT_PASSWORD);
  return session;
}

export async function createNoTeamLeader(request: APIRequestContext, testInfo: TestInfo) {
  const student = await makeStandaloneStudent(request, testInfo);
  const session = await loginApi(request, student.email, student.password);
  await switchMyRole(request, session.token, "LEADER");
  return loginApi(request, student.email, student.password);
}

export async function makeStandaloneStudent(request: APIRequestContext, testInfo: TestInfo) {
  const admin = await adminSession(request);
  return createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-standalone`);
}

