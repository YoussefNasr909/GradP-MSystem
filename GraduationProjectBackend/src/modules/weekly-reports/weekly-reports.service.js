import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";
import { prisma } from "../../loaders/dbLoader.js";
import { teamUserSelect, findTeamById, findTeamByLeaderId, findTeamMemberByUserId, listTeams } from "../teams/teams.repository.js";
import {
  buildGamificationIdempotencyKey,
  emitGamificationEvent,
} from "../gamification/gamification.emitter.js";

const weeklyReportSelect = {
  id: true,
  teamId: true,
  submittedById: true,
  reviewedById: true,
  weekLabel: true,
  periodStart: true,
  periodEnd: true,
  summaryDraft: true,
  summaryFinal: true,
  githubActivity: true,
  status: true,
  reviewComment: true,
  isSubmitted: true,
  submittedAt: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  team: {
    select: {
      id: true,
      name: true,
      stage: true,
      leader: { select: teamUserSelect },
      doctor: { select: teamUserSelect },
      ta: { select: teamUserSelect },
    },
  },
  submittedBy: { select: teamUserSelect },
  reviewedBy: { select: teamUserSelect },
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function buildFullName(user) {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
}

function toUserSummary(user) {
  if (!user) return null;
  return {
    ...user,
    fullName: buildFullName(user),
  };
}

function toWeeklyReportResponse(report) {
  return {
    id: report.id,
    teamId: report.teamId,
    weekLabel: report.weekLabel,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    summaryDraft: report.summaryDraft ?? "",
    summaryFinal: report.summaryFinal ?? "",
    githubActivity: report.githubActivity ?? null,
    status: report.status,
    reviewComment: report.reviewComment ?? "",
    isSubmitted: report.isSubmitted,
    submittedAt: report.submittedAt ?? null,
    reviewedAt: report.reviewedAt ?? null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    team: report.team
      ? {
          id: report.team.id,
          name: report.team.name,
          stage: report.team.stage,
          leader: toUserSummary(report.team.leader),
          doctor: toUserSummary(report.team.doctor),
          ta: toUserSummary(report.team.ta),
        }
      : null,
    submittedBy: toUserSummary(report.submittedBy),
    reviewedBy: toUserSummary(report.reviewedBy),
  };
}

function canViewTeam(actor, team) {
  if (!team) return false;
  if (actor.role === ROLES.ADMIN) return true;
  if (team.leader?.id === actor.id || team.doctor?.id === actor.id || team.ta?.id === actor.id) return true;
  return team.members?.some((member) => member.user.id === actor.id) ?? false;
}

function canSubmitTeamReport(actor, team) {
  if (!team) return false;
  if (actor.role === ROLES.ADMIN) return true;
  if (team.leader?.id === actor.id) return true;
  return team.members?.some((member) => member.user.id === actor.id) ?? false;
}

function canReviewTeamReport(actor, team) {
  if (!team) return false;
  if (actor.role === ROLES.ADMIN) return true;
  return team.doctor?.id === actor.id || team.ta?.id === actor.id;
}

async function resolveActorTeamIds(actor, requestedTeamId) {
  const normalizedTeamId = normalizeText(requestedTeamId) || null;
  if (normalizedTeamId) {
    const team = await findTeamById(normalizedTeamId);
    if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
    if (!canViewTeam(actor, team)) {
      throw new AppError("You cannot access weekly reports for this team.", 403, "WEEKLY_REPORT_TEAM_FORBIDDEN");
    }
    return [team.id];
  }

  if (actor.role === ROLES.ADMIN) {
    const teams = await listTeams({});
    return teams.map((team) => team.id);
  }

  if (actor.role === ROLES.DOCTOR || actor.role === ROLES.TA) {
    const teams = await listTeams(actor.role === ROLES.DOCTOR ? { doctorId: actor.id } : { taId: actor.id });
    return teams.map((team) => team.id);
  }

  if (actor.role === ROLES.LEADER) {
    const team = await findTeamByLeaderId(actor.id);
    return team ? [team.id] : [];
  }

  const membership = await findTeamMemberByUserId(actor.id);
  return membership?.team?.id ? [membership.team.id] : [];
}

async function resolveReportForActor(actor, reportId) {
  const report = await prisma.weeklyReport.findUnique({
    where: { id: reportId },
    select: weeklyReportSelect,
  });
  if (!report) throw new AppError("Weekly report not found.", 404, "WEEKLY_REPORT_NOT_FOUND");

  const team = await findTeamById(report.teamId);
  if (!canViewTeam(actor, team)) {
    throw new AppError("You cannot access this weekly report.", 403, "WEEKLY_REPORT_FORBIDDEN");
  }

  return { report, team };
}

function emitWeeklyReportApprovedEvent(report, actor) {
  emitGamificationEvent({
    eventType: "WEEKLY_REPORT_APPROVED",
    sourceType: "WeeklyReport",
    sourceId: report.id,
    idempotencyKey: buildGamificationIdempotencyKey("WEEKLY_REPORT_APPROVED", "WeeklyReport", report.id),
    teamId: report.teamId,
    actorUserId: actor.id,
    payload: {
      weeklyReportId: report.id,
      weekLabel: report.weekLabel,
      submittedByUserId: report.submittedById ?? null,
      reviewedByUserId: actor.id,
      reviewedAt: report.reviewedAt?.toISOString?.() ?? new Date().toISOString(),
      teamId: report.teamId,
    },
  });
}

export async function listWeeklyReportsService(actor, filters = {}) {
  const teamIds = await resolveActorTeamIds(actor, filters.teamId);
  if (teamIds.length === 0) {
    return {
      items: [],
      total: 0,
      page: filters.page ?? 1,
      limit: filters.limit ?? 25,
      totalPages: 0,
    };
  }

  const page = Math.max(1, Number(filters.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(filters.limit ?? 25)));
  const where = {
    teamId: { in: teamIds },
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.weeklyReport.findMany({
      where,
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: weeklyReportSelect,
    }),
    prisma.weeklyReport.count({ where }),
  ]);

  return {
    items: items.map(toWeeklyReportResponse),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function submitWeeklyReportService(actor, reportId, payload) {
  const { report, team } = await resolveReportForActor(actor, reportId);
  if (!canSubmitTeamReport(actor, team)) {
    throw new AppError("Only team members can submit this weekly report.", 403, "WEEKLY_REPORT_SUBMIT_FORBIDDEN");
  }

  if (report.status === "APPROVED") {
    throw new AppError("Approved weekly reports cannot be resubmitted.", 409, "WEEKLY_REPORT_ALREADY_APPROVED");
  }

  const updated = await prisma.weeklyReport.update({
    where: { id: report.id },
    data: {
      summaryFinal: normalizeText(payload.summaryFinal),
      isSubmitted: true,
      status: "SUBMITTED",
      submittedById: actor.id,
      submittedAt: new Date(),
      reviewedById: null,
      reviewedAt: null,
      reviewComment: null,
    },
    select: weeklyReportSelect,
  });

  return toWeeklyReportResponse(updated);
}

export async function reviewWeeklyReportService(actor, reportId, payload) {
  const { report, team } = await resolveReportForActor(actor, reportId);
  if (!canReviewTeamReport(actor, team)) {
    throw new AppError("Only the assigned TA, doctor, or admin can review this weekly report.", 403, "WEEKLY_REPORT_REVIEW_FORBIDDEN");
  }

  if (!report.isSubmitted || report.status === "DRAFT") {
    throw new AppError("Submit the weekly report before review.", 409, "WEEKLY_REPORT_NOT_SUBMITTED");
  }

  if (report.status === "APPROVED" && payload.decision === "APPROVED") {
    throw new AppError("This weekly report is already approved.", 409, "WEEKLY_REPORT_ALREADY_APPROVED");
  }

  const updated = await prisma.weeklyReport.update({
    where: { id: report.id },
    data: {
      status: payload.decision,
      reviewedById: actor.id,
      reviewedAt: new Date(),
      reviewComment: normalizeText(payload.reviewComment) || null,
    },
    select: weeklyReportSelect,
  });

  if (payload.decision === "APPROVED") {
    emitWeeklyReportApprovedEvent(updated, actor);
  }

  return toWeeklyReportResponse(updated);
}
