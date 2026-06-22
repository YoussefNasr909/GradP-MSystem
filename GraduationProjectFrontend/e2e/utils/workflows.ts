import { expect, type APIRequestContext } from "@playwright/test";
import { expectApiOk } from "./api";
import type { AuthSession } from "./auth";

export function dateOnly(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export function isoOffset(minutes = 0) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export function proposalPayload(suffix: string, overrides: Record<string, unknown> = {}) {
  return {
    title: `E2E Proposal ${suffix}`.slice(0, 180),
    abstract:
      "This proposal describes a graduation project quality system with clear problem framing, reliable scope, and measurable delivery goals.",
    problemStatement:
      "Graduation project teams need a dependable platform to coordinate progress, feedback, evidence, review decisions, and final defense readiness without losing auditability.",
    scope: "The project covers team workflows, deliverables, review feedback, notifications, and supervisor collaboration for one semester.",
    methodology: "The team will use iterative delivery, weekly reports, automated testing, peer review, and supervisor feedback loops.",
    timeline: "Weeks 1-4 requirements and design, weeks 5-11 implementation, weeks 12-14 testing, weeks 15-16 deployment.",
    objectives: ["Track team progress", "Improve review quality", "Document final evidence"],
    technologies: ["Next.js", "Express", "PostgreSQL"],
    deliverables: ["SRS", "Prototype", "Final report"],
    ...overrides,
  };
}

export async function createProposal(request: APIRequestContext, leader: AuthSession, suffix: string) {
  const result = await expectApiOk<any>(request, "/proposals", {
    method: "POST",
    token: leader.token,
    data: proposalPayload(suffix),
  });
  expect(result.data.title).toContain("E2E Proposal");
  return result.data;
}

export async function createSprint(request: APIRequestContext, leader: AuthSession, teamId: string, suffix: string) {
  const result = await expectApiOk<any>(request, "/sprints", {
    method: "POST",
    token: leader.token,
    data: {
      teamId,
      name: `E2E Sprint ${suffix}`.slice(0, 110),
      goal: "Deliver a vertical slice with automated validation.",
      startDate: dateOnly(1),
      endDate: dateOnly(14),
      status: "PLANNED",
    },
  });
  return result.data;
}

export async function createTask(
  request: APIRequestContext,
  leader: AuthSession,
  teamId: string,
  assigneeUserId: string,
  suffix: string,
) {
  const result = await expectApiOk<any>(request, "/tasks", {
    method: "POST",
    token: leader.token,
    data: {
      teamId,
      title: `E2E Task ${suffix}`.slice(0, 190),
      description: "A task created by the E2E suite for lifecycle and review coverage.",
      priority: "MEDIUM",
      storyPoints: 3,
      taskType: "CODE",
      integrationMode: "MANUAL",
      startDate: dateOnly(1),
      endDate: dateOnly(7),
      assigneeUserId,
    },
  });
  return result.data;
}

export function meetingPayload(teamId: string, suffix: string, overrides: Record<string, unknown> = {}) {
  return {
    teamId,
    title: `E2E Meeting ${suffix}`.slice(0, 140),
    description: "E2E meeting scheduled to verify lifecycle and calendar integration.",
    agenda: "Discuss progress, risks, and next deliverables.",
    startAt: isoOffset(120),
    endAt: isoOffset(180),
    timezone: "Africa/Cairo",
    mode: "VIRTUAL",
    provider: "MANUAL",
    includeTeamMembers: true,
    includeDoctor: true,
    includeTa: true,
    ...overrides,
  };
}

export async function createMeeting(request: APIRequestContext, session: AuthSession, teamId: string, suffix: string) {
  const result = await expectApiOk<any>(request, "/meetings", {
    method: "POST",
    token: session.token,
    data: meetingPayload(teamId, suffix),
  });
  return result.data;
}

